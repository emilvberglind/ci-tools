package main

import (
	"fmt"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"k8s.io/test-infra/prow/cmd/generic-autobumper/bumper"
	"k8s.io/test-infra/prow/config/secret"
	"k8s.io/test-infra/prow/flagutil"
	"k8s.io/test-infra/prow/github"
	"os"
	"sync"
)

type repo struct {
	path    string
	inUseBy string
	lock    sync.RWMutex
}

var (
	ghClient       github.Client
	systemGhClient github.Client
	numRepos       int
	availableRepos []*repo
	inUseRepos     []*repo
)

func initRepoManager(githubOptions flagutil.GitHubOptions) {
	logrus.SetLevel(logrus.DebugLevel)
	//if err := validateOptions(o); err != nil {
	//	logrus.WithError(err).Fatal("Invalid arguments.")
	//}
	numRepos = 4

	sa := &secret.Agent{}
	if err := sa.Start([]string{githubOptions.TokenPath}); err != nil {
		logrus.WithError(err).Fatal("Failed to start secrets agent")
	}

	var err error
	ghClient, err = githubOptions.GitHubClient(sa, false)
	if err != nil {
		logrus.WithError(err).Fatal("error getting GitHub client")
	}

	stdout := bumper.HideSecretsWriter{Delegate: os.Stdout, Censor: sa}
	stderr := bumper.HideSecretsWriter{Delegate: os.Stderr, Censor: sa}

	repoChannel := make(chan *repo)
	for i := 0; i < numRepos; i++ {
		go func(repoChannel chan *repo) {
			repo := initRepo(stdout, stderr)
			repoChannel <- repo
			logrus.Debugf("Initialized repo %v", repo)
		}(repoChannel)
	}
	for i := 0; i < numRepos; i++ {
		availableRepos = append(availableRepos, <-repoChannel)
	}

	logrus.Debugf("Done initializing repos. %v", availableRepos)
}

func initRepo(stdout, stderr bumper.HideSecretsWriter) *repo {
	path, err := ioutil.TempDir("", "repo-manager-release")
	if err != nil {
		logrus.WithError(err).Fatal("Failed to make dir.")
	}
	thisRepo := repo{
		path: path,
	}

	err = bumper.Call(stdout, stderr, "git", []string{"clone", "https://github.com/openshift/release.git", thisRepo.path}...)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to clone repo.")
	}

	return &thisRepo
}

func retrieveAndLockAvailable(githubUsername string) *repo {
	if len(availableRepos) > 0 {
		availableRepo := availableRepos[0]
		availableRepos = append(availableRepos[0:], availableRepos[1:]...)
		availableRepo.inUseBy = githubUsername
		inUseRepos = append(inUseRepos, availableRepo)

		return availableRepo
	}

	return nil
}

func returnInUse(r *repo) {
	for i, cr := range inUseRepos {
		if r == cr {
			inUseRepos = append(inUseRepos[i:], inUseRepos[i+1:]...)
			availableRepos = append(availableRepos, r)
		}
	}
}

func pushChanges(githubUsername, githubToken string) error {
	logrus.Warnf("Pushing changes")
	const targetBranch = "new-repo-initializer"
	if err := bumper.GitCommitAndPush(
		fmt.Sprintf("https://%s:%s@github.com/%s/release.git", githubUsername, githubToken, githubUsername),
		targetBranch,
		githubUsername,
		fmt.Sprintf("%s@users.noreply.github.com", githubUsername),
		"Create new config",
		os.Stdout,
		os.Stderr,
		false,
	); err != nil {
		return fmt.Errorf("failed to push changes: %w", err)
	}
	return nil
}

//
//func checkout(steps []step, author string, stdout, stderr io.Writer) (needsPushing bool, err error) {
//	startCommitOut, err := exec.Command("git", "rev-parse", "HEAD").CombinedOutput()
//	if err != nil {
//		return false, fmt.Errorf("failed to execute `git rev-parse HEAD`: %w\noutput:%s\n", err, string(startCommitOut))
//	}
//	startCommitSHA := strings.TrimSpace(string(startCommitOut))
//
//	var didCommit bool
//	for _, step := range steps {
//		committed, err := runAndCommitIfNeeded(stdout, stderr, author, step.command, step.arguments)
//		if err != nil {
//			return false, fmt.Errorf("failed to run command and commit the changes: %w", err)
//		}
//
//		if committed {
//			didCommit = didCommit || true
//		}
//	}
//
//	if !didCommit {
//		logrus.Info("No new commits")
//		return false, nil
//	}
//
//	overallDiff, err := exec.Command("git", "diff", startCommitSHA).CombinedOutput()
//	if err != nil {
//		return false, fmt.Errorf("failed to check the overall diff: %w, out:\n%s\n", err, string(overallDiff))
//	}
//	if strings.TrimSpace(string(overallDiff)) == "" {
//		logrus.Info("Empty overall diff")
//		return false, nil
//	}
//
//	return true, nil
//}
