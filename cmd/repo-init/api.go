package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/ghodss/yaml"
	"github.com/openshift/ci-tools/pkg/api"
	"github.com/openshift/ci-tools/pkg/load"
	"github.com/openshift/ci-tools/pkg/registry"
	"github.com/openshift/ci-tools/pkg/validation"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	prowConfig "k8s.io/test-infra/prow/config"
	"k8s.io/test-infra/prow/flagutil"
	"k8s.io/test-infra/prow/interrupts"
	"k8s.io/test-infra/prow/metrics"
	"k8s.io/test-infra/prow/pjutil"
	"k8s.io/test-infra/prow/simplifypath"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

// l keeps the tree legible
func l(fragment string, children ...simplifypath.Node) simplifypath.Node {
	return simplifypath.L(fragment, children...)
}

type frontendServer struct {
	logger *logrus.Entry
	lock   sync.RWMutex
}

var (
	apiMetrics    = metrics.NewMetrics("repo_init_api")
	resolver      registry.Resolver
	releaseRepo   string
	githubOptions flagutil.GitHubOptions
)

type validationResponse struct {
	Valid            bool              `json:"valid"`
	Message          string            `json:"message"`
	ValidationErrors []validationError `json:"errors"`
}

type validationError struct {
	Key     string `json:"key"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

type validationType string

const (
	All                  = validationType("ALL")
	BaseImages           = validationType("BASE_IMAGES")
	Tests                = validationType("TESTS")
	OperatorBundle       = validationType("OPERATOR_BUNDLE")
	OperatorSubstitution = validationType("OPERATOR_SUBSTITUTION")
)

func serveAPI(port, healthPort, numRepos int, releaseRepoPath, registryPath string, ghOptions flagutil.GitHubOptions) {
	releaseRepo = releaseRepoPath
	githubOptions = ghOptions

	initRepoManager(numRepos)

	logger := logrus.WithField("component", "api")

	health := pjutil.NewHealthOnPort(healthPort)
	health.ServeReady()

	metrics.ExposeMetrics("repo-init-api", prowConfig.PushGateway{}, flagutil.DefaultMetricsPort)
	simplifier := simplifypath.NewSimplifier(l("", // shadow element mimicing the root
		l("api",
			l("configs"),
			l("config-validations"),
		),
	))
	handler := metrics.TraceHandler(simplifier, uiMetrics.HTTPRequestDuration, uiMetrics.HTTPResponseSize)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/configs", handler(configHandler()).ServeHTTP)
	mux.HandleFunc("/api/config-validations", handler(configValidationHandler()).ServeHTTP)
	httpServer := &http.Server{Addr: ":" + strconv.Itoa(port), Handler: mux}
	interrupts.ListenAndServe(httpServer, 5*time.Second)
	logger.Debug("Ready to serve HTTP requests.")
}

func configValidationHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		disableCORS(w)
		switch r.Method {
		case http.MethodPost:
			validateConfig(w, r)
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}
}

func configHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		disableCORS(w)
		switch r.Method {
		case http.MethodGet:
			loadConfigs(w, r)
		case http.MethodPost:
			generateConfig(w, r)
		case http.MethodPut:
			//Not currently used, but will be when updating configs.
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}
}

func disableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func loadConfigs(w http.ResponseWriter, r *http.Request) {
	org := r.URL.Query().Get("org")
	repo := r.URL.Query().Get("repo")

	configs, err := load.FromPathByOrgRepo(getConfigPath(org, repo))

	if err != nil {
		logrus.WithError(err).Error("Error while loading configs")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	if len(configs) == 0 {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	marshalledConfigs, err := json.Marshal(configs)

	if err != nil {
		logrus.WithError(err).Error("Error while marhalling configs")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, err = w.Write(marshalledConfigs)
	if err != nil {
		logrus.WithError(err).Error("Error while writing response")
		w.WriteHeader(http.StatusBadRequest)
		return
	}
}

type ValidationRequest struct {
	ValidationType validationType  `json:"validation_type"`
	Data           json.RawMessage `json:"data"`
}

type ConfigValidationRequest struct {
	Config initConfig `json:"config"`
}

type SubstitutionValidationRequest struct {
	ConfigValidationRequest
	Substitution api.PullSpecSubstitution `json:"substitution"`
}

func unmarshalValidationRequest(data []byte) (validationType, interface{}) {
	input := &ValidationRequest{}
	err := json.Unmarshal(data, input)
	if err != nil {
		return "", nil
	}

	switch input.ValidationType {
	case OperatorSubstitution:
		request := &SubstitutionValidationRequest{}
		_ = json.Unmarshal(input.Data, request)

		return input.ValidationType, request
	default:
		request := &ConfigValidationRequest{}
		_ = json.Unmarshal(input.Data, request)

		return input.ValidationType, request
	}
}

func validateConfig(w http.ResponseWriter, r *http.Request) {
	body, err := ioutil.ReadAll(r.Body)

	if err != nil {
		logrus.WithError(err).Error("Error while reading request body")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	validationType, validationObject := unmarshalValidationRequest(body)

	var validationErrors []error

	// See if this is just acting on the whole configuration.
	if configRequest, ok := validationObject.(*ConfigValidationRequest); ok {
		generated, err := createCIOperatorConfig(configRequest.Config, releaseRepo, false)

		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logrus.WithError(err).Error("Unable to generate ci-operator config")
			return
		}

		context := validation.NewConfigContext()

		switch validationType {
		case BaseImages:
			validationErrors = append(validationErrors, validation.ValidateBaseImages(context.AddField("base_images"), generated.BaseImages)...)
		case OperatorBundle:
			validationErrors = append(validationErrors, validation.ValidateOperator(context.AddField("operator_bundle"), generated)...)
		case Tests:
			v := validation.NewValidator()
			validationErrors = append(validationErrors, v.ValidateTestStepConfiguration(context.AddField("tests"), generated, false)...)
		default:
			logrus.WithError(err).Error("Invalid validation type specified")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
	} else if substitutionRequest, ok := validationObject.(*SubstitutionValidationRequest); ok {
		// We're validating an operator pullspec substitution
		generated, err := createCIOperatorConfig(substitutionRequest.Config, releaseRepo, false)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logrus.WithError(err).Error("Unable to generate ci-operator config")
			return
		}

		linkForImage := func(image string) api.StepLink {
			return validation.LinkForImage(image, generated)
		}

		context := validation.NewConfigContext()
		if err := validation.ValidateOperatorSubstitution(context.AddField("operator_substitution"), substitutionRequest.Substitution, linkForImage); err != nil {
			validationErrors = append(validationErrors, err)
		}
	}

	response := validationResponse{Valid: true}
	if len(validationErrors) > 0 {
		response.Valid = false
		logrus.WithError(err).Errorf("Caught errors %v", validationErrors)

		for _, e := range validationErrors {
			errorString := e.Error()
			errorComponents := strings.Split(errorString, ".")
			if len(errorComponents) > 1 {
				response.ValidationErrors = append(response.ValidationErrors, validationError{
					Field:   errorComponents[0],
					Message: errorComponents[len(errorComponents)-1],
				})
			} else {
				response.ValidationErrors = append(response.ValidationErrors, validationError{
					Key:     "generic",
					Message: errorString,
				})
			}
		}
		w.WriteHeader(http.StatusBadRequest)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	marshalled, err := json.Marshal(response)
	if err != nil {
		logrus.WithError(err).Error("Failed to marshal validation errors")
	}
	_, _ = w.Write(marshalled)
}

func getConfigPath(org, repo string) string {
	pathElements := []string{releaseRepo, "ci-operator", "config", org}
	if repo != "" {
		pathElements = append(pathElements, repo)
	}
	configPath := path.Join(pathElements...)

	return configPath
}

// generateConfig is responsible for taking the initConfig and converting it into an api.ReleaseBuildConfiguration. Optionally
// this function may also push this config to GitHub and create a pull request for the o/release repo.
func generateConfig(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := ioutil.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		logrus.WithError(err).Error("Unable to read request body")
		return
	}

	var config initConfig
	err = json.Unmarshal(bodyBytes, &config)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		logrus.WithError(err).Error("Unable to marshal request body")
		return
	}

	// if we're only converting the initConfig, then we won't create a pull request.
	if conversionOnly, err := strconv.ParseBool(r.URL.Query().Get("conversionOnly")); err == nil && conversionOnly == true {
		generatedConfig, err := createCIOperatorConfig(config, releaseRepo, false)

		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logrus.WithError(err).Error("could not generate new CI Operator configuration")
			return
		}
		marshalled, err := yaml.Marshal(generatedConfig)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logrus.WithError(err).Error("could not marshal CI Operator configuration")
			return
		}
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write(marshalled); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			logrus.WithError(err).Error("Could not write CI Operator configuration response")
			return
		}
		return
	}

	githubUser := r.Header.Get("github_user")

	// since we're going to be interacting with git, grab one of the checked out o/release repos and assign it to the current
	// user. we'll hold on to this until all git interactions are complete to prevent weirdness resulting from multiple users
	// dealing with the same working copy.
	repo := retrieveAndLockAvailable(githubUser)
	releaseRepo := repo.path

	exists := configExists(config.Org, config.Repo)
	if exists {
		w.WriteHeader(http.StatusConflict)
		_, _ = fmt.Fprintf(w, "Config already exists for org: %s and repo: %s", config.Org, config.Repo)
		return
	}

	if err := updateProwConfig(config, releaseRepo); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not update Prow configuration")
	}

	if err := updatePluginConfig(config, releaseRepo); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not update Prow plugin configuration")
	}

	if _, err := createCIOperatorConfig(config, releaseRepo, true); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not generate new CI Operator configuration")
	}

	createPR, _ := strconv.ParseBool(r.URL.Query().Get("generatePR"))
	createdRepo, err := pushChanges(githubUser, r.Header.Get("access_token"), createPR)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not push changes")
	} else {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(createdRepo))
	}

	returnInUse(repo)
}

func configExists(org, repo string) bool {
	configPath := path.Join(releaseRepo, "ci-operator", "config", org, repo)
	_, err := os.Stat(configPath)
	return err == nil
}
