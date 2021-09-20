package main

import (
	"fmt"
	"github.com/sirupsen/logrus"
	"io/ioutil"
	"k8s.io/test-infra/prow/cmd/generic-autobumper/bumper"
	"k8s.io/test-infra/prow/config/secret"
	"os"
	"strconv"
	"sync"
	"time"
)

type repo struct {
	path    string
	inUseBy string
	lock    sync.RWMutex
}

var (
	numRepos       int
	availableRepos []*repo
	inUseRepos     []*repo
)

func initRepoManager(repoCount int) {
	logrus.SetLevel(logrus.DebugLevel)
	//if err := validateOptions(o); err != nil {
	//	logrus.WithError(err).Fatal("Invalid arguments.")
	//}
	numRepos = repoCount

	stdout := bumper.HideSecretsWriter{Delegate: os.Stdout, Censor: secret.Censor}
	stderr := bumper.HideSecretsWriter{Delegate: os.Stderr, Censor: secret.Censor}

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
			r.inUseBy = ""
			availableRepos = append(availableRepos, r)
		}
	}
}

func pushChanges(githubUsername, githubToken string, createPR bool) (string, error) {
	err := os.Chdir(availableRepos[0].path)
	if err != nil {
		logrus.WithError(err).Error("Can't change dir")
		return "", err
	}
	logrus.Warnf("Pushing changes")

	if err := commitChanges(
		"Adding new ci-operator config.",
		fmt.Sprintf("%s@users.noreply.github.com", githubUsername),
		githubUsername,
	); err != nil {
		return "", fmt.Errorf("failed to commit changes: %w", err)
	}

	targetBranch := fmt.Sprintf("new-ci-config-%s", strconv.FormatInt(time.Now().Unix(), 10))
	if err := bumper.GitPush(
		fmt.Sprintf("https://%s:%s@github.com/%s/release.git", githubUsername, githubToken, githubUsername),
		targetBranch,
		os.Stdout,
		os.Stderr,
		availableRepos[0].path,
	); err != nil {
		return "", fmt.Errorf("failed to push changes: %w", err)
	}

	if createPR {
		ghClient := githubOptions.GitHubClientWithAccessToken(githubToken)

		//TODO: fix this
		if err := bumper.UpdatePullRequestWithLabels(
			ghClient,
			"openshift",
			"release",
			"[wip] - Testing testing 123",
			"This is just a fun thing",
			githubUsername+":"+targetBranch,
			"master",
			targetBranch,
			true,
			nil,
			false,
		); err != nil {
			return "", fmt.Errorf("failed to create PR: %w", err)
		}

	}

	return targetBranch, nil
}

func commitChanges(message, email, name string) error {
	if err := bumper.Call(os.Stdout, os.Stderr, "git", "add", "-A"); err != nil {
		return fmt.Errorf("git add: %w", err)
	}
	commitArgs := []string{"commit", "-m", message}
	if name != "" && email != "" {
		commitArgs = append(commitArgs, "--author", fmt.Sprintf("%s <%s>", name, email))
	}

	if err := bumper.Call(os.Stdout, os.Stderr, "git", commitArgs...); err != nil {
		return fmt.Errorf("git commit: %w", err)
	}
	return nil
}
