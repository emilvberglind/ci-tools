import {CloudProvider, RepoConfigInterface} from "@app/types";

export function accessibleRouteChangeHandler() {
  return window.setTimeout(() => {
    const mainContainer = document.getElementById('primary-app-container');
    if (mainContainer) {
      mainContainer.focus();
    }
  }, 50);
}

export function marshallConfig(config) {
  return {
    org: config.org,
    repo: config.repo,
    branch: config.branch,
    canonical_go_repository: config.buildSettings.canonicalGoRepository,
    promotes: config.buildSettings.buildPromotes,
    promotes_with_openshift: config.buildSettings.partOfOSRelease,
    needs_base: config.buildSettings.needsBase,
    needs_os: config.buildSettings.needsOS,
    go_version: config.buildSettings.goVersion,
    build_commands: config.buildSettings.buildCommands,
    test_build_commands: config.buildSettings.testBuildCommands,
    tests: marshallTests(config.tests),
    custom_e2e: marshallE2eTests(config.e2eTests),
    // release_type:,
    // release_version:
  };
}

function marshallTests(tests) {
  let marshalledTests:object[] = [];
  if (tests !== undefined && tests.length > 0) {
    tests.forEach(test => {
      marshalledTests.push({
        as: test.name,
        command: test.testCommands
      });
    })
  }

  return marshalledTests;
}

function marshallE2eTests(tests) {
  let marshalledTests:object[] = [];
  if (tests !== undefined && tests.length > 0) {
    tests.forEach(test => {
      marshalledTests.push({
        as: test.name,
        command: test.testCommands,
        profile: getClusterProfile(test.cloudProvider),
        cli: test.requiresCli
      });
    })
  }

  return marshalledTests;
}

function getClusterProfile(cloudProvider) {
  if (cloudProvider === CloudProvider.Aws) {
    return "aws";
  } else if (cloudProvider === CloudProvider.Azure) {
    return "azure";
  } else if (cloudProvider === CloudProvider.Gcp) {
    return "gcp";
  }

  return "";
}
