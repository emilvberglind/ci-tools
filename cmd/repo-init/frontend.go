package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/openshift/ci-tools/pkg/load"
	"github.com/openshift/ci-tools/pkg/registry"
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
	uiMetrics   = metrics.NewMetrics("repo_init_ui")
	resolver    registry.Resolver
	releaseRepo string
	githubOptions   flagutil.GitHubOptions

	////go:embed frontend/dist
	//static embed.FS
)

//func Setup(releaseRepoPath string) {
//	releaseRepo = releaseRepoPath
//}

func serveUI(port, healthPort int, releaseRepoPath, registryPath string, ghOptions flagutil.GitHubOptions) {
	releaseRepo = releaseRepoPath
	githubOptions = ghOptions

	initRepoManager(githubOptions)

	logger := logrus.WithField("component", "frontend")
	_, err := loadResolver(registryPath)
	if err != nil {
		logger.WithError(err).Fatal("Unable to load resolver.")
	}
	//server := &frontendServer{
	//	logger: logger,
	//	lock:   sync.RWMutex{},
	//}
	health := pjutil.NewHealthOnPort(healthPort)
	health.ServeReady()

	metrics.ExposeMetrics("repo-init", prowConfig.PushGateway{}, flagutil.DefaultMetricsPort)
	simplifier := simplifypath.NewSimplifier(l("", // shadow element mimicing the root
		l(""), // actual UI
		l("api",
			l("configs"),
		),
	))
	handler := metrics.TraceHandler(simplifier, uiMetrics.HTTPRequestDuration, uiMetrics.HTTPResponseSize)
	mux := http.NewServeMux()
	//stripped, err := fs.Sub(static, "frontend/dist")
	//if err != nil {
	//	logger.WithError(err).Fatal("Could not prefix static content.")
	//}
	//mux.HandleFunc("/", handler(http.FileServer(http.FS(stripped))).ServeHTTP)
	//for name := range server.mappings {
	mux.HandleFunc("/api/configs", handler(configHandler()).ServeHTTP)
	mux.HandleFunc("/api/prs", handler(pullRequestHandler()).ServeHTTP)
	//}
	httpServer := &http.Server{Addr: ":" + strconv.Itoa(port), Handler: mux}
	interrupts.ListenAndServe(httpServer, 5*time.Second)
	logger.Debug("Ready to serve HTTP requests.")
}

func loadResolver(path string) (registry.Resolver, error) {
	if path == "" {
		return nil, nil
	}
	refs, chains, workflows, _, _, observers, err := load.Registry(path, load.RegistryFlag(0))
	if err != nil {
		return nil, err
	}
	return registry.NewResolver(refs, chains, workflows, observers), nil
}

func configHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		disableCORS(w)
		switch r.Method {
		case http.MethodGet:
			loadConfigs(w, r)
		case http.MethodPost:
			persistConfig(w, r)
		case http.MethodPut:
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}
}

func pullRequestHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		disableCORS(w)
		switch r.Method {
		case http.MethodPost:
			createPullRequest(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}
}

func createPullRequest(w http.ResponseWriter, r *http.Request) {
	//ghClient := githubOptions.GitHubClientWithAccessToken(strings.Split(r.Header.Get("Authorization"), "token ")[1])
	//
	//prOpts := prcreation.PRCreationOptions{
	//	GithubClient: ghClient,
	//}

	//prOpts.UpsertPR(releaseRepo)
}

func disableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func loadConfigs(w http.ResponseWriter, r *http.Request) () {
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
		//fmt.Fprintf(w, "Config already exists for org: %s and repo: %s", org, repo)
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

func getConfigPath(org, repo string) string {
	pathElements := []string{releaseRepo, "ci-operator", "config", org}
	if repo != "" {
		pathElements = append(pathElements, repo)
	}
	configPath := path.Join(pathElements...)

	return configPath
}

func persistConfig(w http.ResponseWriter, r *http.Request) {
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

	if err := createCIOperatorConfig(config, releaseRepo); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not generate new CI Operator configuration")
	}

	if err := pushChanges("emilvberglind", r.Header.Get("access_token")); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		logrus.WithError(err).Error("could not push changes")
	}

}

func getConfigs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		println(fmt.Sprintf("getConfigs %s", r.URL.RawQuery))

		org := r.URL.Query().Get("org")
		repo := r.URL.Query().Get("repo")

		exists := configExists(org, repo)
		println(fmt.Sprintf("config exists %s", exists))
		if !exists {
			w.WriteHeader(http.StatusNotFound)
			//fmt.Fprintf(w, "Config already exists for org: %s and repo: %s", org, repo)
		}

	}
}

func configExists(org, repo string) bool {
	configPath := path.Join(releaseRepo, "ci-operator", "config", org, repo)
	_, err := os.Stat(configPath)

	return err == nil
}

//func loadResolver(path string) (registry.Resolver, error) {
//	if path == "" {
//		return nil, nil
//	}
//	load.Config()
//	refs, chains, workflows, _, _, observers, err := load.Registry(path, load.RegistryFlag(0))
//	if err != nil {
//		return nil, err
//	}
//	return registry.NewResolver(refs, chains, workflows, observers), nil
//}

//func initGithubClient() {
//	var githubClient pgithub.Client
//	var secretAgent *secret.Agent
//	if opts.TokenPath != "" {
//		secretAgent = &secret.Agent{}
//		if err := secretAgent.Start([]string{opts.TokenPath}); err != nil {
//			logrus.WithError(err).Fatal("Failed to load github token")
//		}
//	}
//
//	var err error
//	githubClient, err = opts.GitHubClient(secretAgent, false)
//	if err != nil {
//		logrus.WithError(err).Fatal("Failed to construct githubClient")
//	}
//}
