package repo_init

import (
	"fmt"
	"io/ioutil"
	"path"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/spf13/afero"

	prowconfig "k8s.io/test-infra/prow/config"
	"k8s.io/test-infra/prow/plugins"
	"sigs.k8s.io/yaml"

	"github.com/openshift/ci-tools/pkg/api"
	ciopconfig "github.com/openshift/ci-tools/pkg/config"
	"github.com/openshift/ci-tools/pkg/prowconfigsharding"
)

type InitConfig struct {
	Org                   string    `json:"org"`
	Repo                  string    `json:"repo"`
	Branch                string    `json:"branch"`
	CanonicalGoRepository string    `json:"canonical_go_repository"`
	Promotes              bool      `json:"promotes"`
	PromotesWithOpenShift bool      `json:"promotes_with_openshift"`
	NeedsBase             bool      `json:"needs_base"`
	NeedsOS               bool      `json:"needs_os"`
	GoVersion             string    `json:"go_version"`
	BuildCommands         string    `json:"build_commands"`
	TestBuildCommands     string    `json:"test_build_commands"`
	Tests                 []Test    `json:"tests"`
	CustomE2E             []E2eTest `json:"custom_e2e"`
	ReleaseType           string    `json:"release_type"`
	ReleaseVersion        string    `json:"release_version"`
}

type Test struct {
	As      string                              `json:"as"`
	From    api.PipelineImageStreamTagReference `json:"from"`
	Command string                              `json:"command"`
}

type E2eTest struct {
	As      string             `json:"as"`
	Profile api.ClusterProfile `json:"profile"`
	Command string             `json:"command"`
	Cli     bool               `json:"cli"`
}

func UpdateProwConfig(config InitConfig, releaseRepo string) error {
	configPath := path.Join(releaseRepo, ciopconfig.ConfigInRepoPath)
	agent := prowconfig.Agent{}
	if err := agent.Start(configPath, "", nil, ""); err != nil {
		return fmt.Errorf("could not load Prow configuration: %w", err)
	}

	prowConfig := agent.Config()
	editProwConfig(prowConfig, config)

	data, err := yaml.Marshal(prowConfig)
	if err != nil {
		return fmt.Errorf("could not marshal Prow configuration: %w", err)
	}

	return ioutil.WriteFile(configPath, data, 0644)
}

func editProwConfig(prowConfig *prowconfig.Config, config InitConfig) {
	fmt.Println(`
Updating Prow configuration ...`)
	queries := prowConfig.Tide.Queries.QueryMap()
	existing := queries.ForRepo(prowconfig.OrgRepo{Org: config.Org, Repo: config.Repo})
	var existingStrings []string
	for _, query := range existing {
		existingStrings = append(existingStrings, query.Query())
	}
	if len(existing) > 0 {
		fmt.Printf(`The following "tide" queries were found that already apply to %s/%s:

%v

No additional "tide" queries will be added.
`, config.Org, config.Repo, strings.Join(existingStrings, "\n"))
		return
	}

	// this is a bit hacky but simple -- we have a couple types of tide interactions
	// and we can set defaults by piggy backing off of other repos we know that are
	// doing it right
	var copyCatQueries prowconfig.TideQueries
	switch {
	case config.Promotes && config.PromotesWithOpenShift:
		copyCatQueries = queries.ForRepo(prowconfig.OrgRepo{Org: "openshift", Repo: "cluster-version-operator"})
	case !config.PromotesWithOpenShift:
		copyCatQueries = queries.ForRepo(prowconfig.OrgRepo{Org: "openshift", Repo: "ci-tools"})
	}

	orgRepo := fmt.Sprintf("%s/%s", config.Org, config.Repo)
	for i := range prowConfig.Tide.Queries {
		for _, copyCat := range copyCatQueries {
			if reflect.DeepEqual(prowConfig.Tide.Queries[i], copyCat) {
				prowConfig.Tide.Queries[i].Repos = append(prowConfig.Tide.Queries[i].Repos, orgRepo)
			}
		}
	}
}

func UpdatePluginConfig(config InitConfig, releaseRepo string) error {
	fmt.Println(`
Updating Prow plugin configuration ...`)
	configPath := path.Join(releaseRepo, ciopconfig.PluginConfigInRepoPath)
	supplementalPluginConfigDir := path.Join(releaseRepo, filepath.Dir(ciopconfig.PluginConfigInRepoPath))
	agent := plugins.ConfigAgent{}
	if err := agent.Load(configPath, []string{supplementalPluginConfigDir}, "_pluginconfig.yaml", false); err != nil {
		return fmt.Errorf("could not load Prow plugin configuration: %w", err)
	}

	pluginConfig := agent.Config()
	editPluginConfig(pluginConfig, config)

	pluginConfig, err := prowconfigsharding.WriteShardedPluginConfig(pluginConfig, afero.NewBasePathFs(afero.NewOsFs(), filepath.Join(releaseRepo, "core-services/prow/02_config")))
	if err != nil {
		return fmt.Errorf("failed to write plugin config shards: %w", err)
	}

	data, err := yaml.Marshal(pluginConfig)
	if err != nil {
		return fmt.Errorf("could not marshal Prow plugin configuration: %w", err)
	}

	return ioutil.WriteFile(configPath, data, 0644)
}

func editPluginConfig(pluginConfig *plugins.Configuration, config InitConfig) {
	orgRepo := fmt.Sprintf("%s/%s", config.Org, config.Repo)
	_, orgRegistered := pluginConfig.Plugins[config.Org]
	_, repoRegistered := pluginConfig.Plugins[orgRepo]
	switch {
	case !orgRegistered && !repoRegistered:
		// the repo needs all plugins
		fmt.Println(`
No prior Prow plugin configuration was found for this organization or repository.
Ensure that webhooks are set up for Prow to watch GitHub state.`)
		pluginConfig.Plugins[orgRepo] = plugins.OrgPlugins{Plugins: append(pluginConfig.Plugins["openshift"].Plugins, pluginConfig.Plugins["openshift/origin"].Plugins...)}
	case orgRegistered && !repoRegistered:
		// we just need the repo-specific bits
		pluginConfig.Plugins[orgRepo] = plugins.OrgPlugins{Plugins: pluginConfig.Plugins["openshift/origin"].Plugins}
	}

	_, orgRegisteredExternal := pluginConfig.ExternalPlugins[config.Org]
	_, repoRegisteredExternal := pluginConfig.ExternalPlugins[orgRepo]
	if !orgRegisteredExternal && !repoRegisteredExternal {
		// the repo needs all plugins
		pluginConfig.ExternalPlugins[orgRepo] = pluginConfig.ExternalPlugins["openshift"]
	}

	// TODO: make PR to remove trigger config
	// TODO: update bazel and make PR for exposing LGTM and Approval configs
	no := false
	pluginConfig.Approve = append(pluginConfig.Approve, plugins.Approve{
		Repos:               []string{orgRepo},
		RequireSelfApproval: &no,
		LgtmActsAsApprove:   false,
	})
	pluginConfig.Lgtm = append(pluginConfig.Lgtm, plugins.Lgtm{
		Repos:            []string{orgRepo},
		ReviewActsAsLgtm: true,
	})
}

func CreateCIOperatorConfig(config InitConfig, releaseRepo string) error {
	fmt.Println(`
Generating CI Operator configuration ...`)
	info := api.Metadata{
		Org:    "openshift",
		Repo:   "origin",
		Branch: "master",
	}
	originPath := path.Join(releaseRepo, ciopconfig.CiopConfigInRepoPath, info.RelativePath())
	var originConfig *api.ReleaseBuildConfiguration
	if err := ciopconfig.OperateOnCIOperatorConfig(originPath, func(configuration *api.ReleaseBuildConfiguration, _ *ciopconfig.Info) error {
		originConfig = configuration
		return nil
	}); err != nil {
		return fmt.Errorf("failed to load configuration for openshift/origin: %w", err)
	}

	generated := generateCIOperatorConfig(config, originConfig.PromotionConfiguration)
	return generated.CommitTo(path.Join(releaseRepo, ciopconfig.CiopConfigInRepoPath))
}

func generateCIOperatorConfig(config InitConfig, originConfig *api.PromotionConfiguration) ciopconfig.DataWithInfo {
	generated := ciopconfig.DataWithInfo{
		Info: ciopconfig.Info{
			Metadata: api.Metadata{
				Org:    config.Org,
				Repo:   config.Repo,
				Branch: config.Branch,
			},
		},
		Configuration: api.ReleaseBuildConfiguration{
			BinaryBuildCommands:     config.BuildCommands,
			TestBinaryBuildCommands: config.TestBuildCommands,
			Tests:                   []api.TestStepConfiguration{},
			Resources: map[string]api.ResourceRequirements{"*": {
				Limits:   map[string]string{"memory": "4Gi"},
				Requests: map[string]string{"memory": "200Mi", "cpu": "100m"},
			}},
		},
	}

	if config.CanonicalGoRepository != "" {
		generated.Configuration.CanonicalGoRepository = &config.CanonicalGoRepository
	}

	if config.Promotes {
		generated.Configuration.PromotionConfiguration = &api.PromotionConfiguration{
			Namespace: originConfig.Namespace,
			Name:      originConfig.Name,
		}
		generated.Configuration.ReleaseTagConfiguration = &api.ReleaseTagConfiguration{
			Namespace: originConfig.Namespace,
			Name:      originConfig.Name,
		}
		if config.PromotesWithOpenShift {
			workflow := "openshift-e2e-aws"
			generated.Configuration.Tests = append(generated.Configuration.Tests, api.TestStepConfiguration{
				As: "e2e-aws",
				MultiStageTestConfiguration: &api.MultiStageTestConfiguration{
					Workflow:       &workflow,
					ClusterProfile: "aws",
				},
			})
		}
	}

	if config.NeedsBase || config.NeedsOS {
		if generated.Configuration.BaseImages == nil {
			generated.Configuration.BaseImages = map[string]api.ImageStreamTagReference{}
		}
	}

	if config.NeedsBase {
		generated.Configuration.BaseImages["base"] = api.ImageStreamTagReference{
			Namespace: originConfig.Namespace,
			Name:      originConfig.Name,
			Tag:       "base",
		}
	}

	if config.NeedsOS {
		generated.Configuration.BaseImages["os"] = api.ImageStreamTagReference{
			Namespace: "openshift",
			Name:      "centos",
			Tag:       "7",
		}
	}

	generated.Configuration.BuildRootImage = &api.BuildRootImageConfiguration{
		ImageStreamTagReference: &api.ImageStreamTagReference{
			Namespace: "openshift",
			Name:      "release",
			Tag:       fmt.Sprintf("golang-%s", config.GoVersion),
		},
	}

	for _, test := range config.Tests {
		generated.Configuration.Tests = append(generated.Configuration.Tests, api.TestStepConfiguration{
			As:       test.As,
			Commands: test.Command,
			ContainerTestConfiguration: &api.ContainerTestConfiguration{
				From: test.From,
			},
		})
	}

	for _, test := range config.CustomE2E {
		t := api.TestStepConfiguration{
			As: test.As,
			MultiStageTestConfiguration: &api.MultiStageTestConfiguration{
				Workflow:       determineWorkflowFromClusterPorfile(test.Profile),
				ClusterProfile: test.Profile,
				Test: []api.TestStep{
					{
						LiteralTestStep: &api.LiteralTestStep{
							As:        test.As,
							Commands:  test.Command,
							From:      "src",
							Resources: api.ResourceRequirements{Requests: map[string]string{"cpu": "100m"}},
						},
					},
				},
			},
		}

		if test.Cli {
			t.MultiStageTestConfiguration.Test[0].Cli = "latest"
		}

		generated.Configuration.Tests = append(generated.Configuration.Tests, t)
	}

	if config.ReleaseType != "" {
		release := api.UnresolvedRelease{}
		switch config.ReleaseType {
		case "nightly":
			release.Candidate = &api.Candidate{
				Product:      api.ReleaseProductOCP,
				Architecture: api.ReleaseArchitectureAMD64,
				Stream:       api.ReleaseStreamNightly,
				Version:      config.ReleaseVersion,
			}
		case "published":
			release.Release = &api.Release{
				Architecture: api.ReleaseArchitectureAMD64,
				Channel:      api.ReleaseChannelStable,
				Version:      config.ReleaseVersion,
			}
		}
		generated.Configuration.Releases = map[string]api.UnresolvedRelease{api.LatestReleaseName: release}
	}
	return generated
}

func determineWorkflowFromClusterPorfile(clusterProfile api.ClusterProfile) *string {
	var ret string
	switch clusterProfile {
	case api.ClusterProfileAWS:
		ret = "ipi-aws"
	case api.ClusterProfileAWSArm64:
		ret = "ipi-aws"
	case api.ClusterProfileAzure:
		ret = "ipi-azure"
	case api.ClusterProfileGCP:
		ret = "ipi-gcp"
	}
	return &ret
}
