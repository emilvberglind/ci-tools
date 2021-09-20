import React, {useContext, useEffect, useState} from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  FormGroup,
  Select,
  SelectOption,
  SelectVariant,
  TextInput
} from '@patternfly/react-core';
import {ConfigContext, setVal, UpdateGraphType, WizardContext} from "@app/types";
import {PullspecSubstitutions} from "@app/BuildConfig/PullspecSubstitutions";
import {BaseImages} from "@app/BuildConfig/BaseImages";
import {ErrorMessage} from "@app/Common/Messaging";

const RepoBuildConfig: React.FunctionComponent = () => {
  const context = useContext(WizardContext);
  const configContext = useContext(ConfigContext);
  const [updateGraphTypeOpen, setUpdateGraphTypeOpen] = useState(false)

  useEffect(() => {
    validate();
  }, []);

  function handleChange(val, event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    let config = {...configContext.config};
    setVal(config.buildSettings, target.name, value);
    configContext.setConfig(config);
    validate();
  }

  function validate() {
    let buildSettings = configContext.config.buildSettings;
    let valid = buildSettings &&
      buildSettings.goVersion &&
      buildSettings.buildCommands &&
      buildSettings.testBuildCommands;
    if (valid) {
      context.setStep({
        ...context.step,
        errorMessages: [],
        stepIsComplete: true
      });
    } else {
      context.setStep({
        ...context.step,
        stepIsComplete: false
      });

    }
  }

  function changeUpdateGraphType(e, val) {
    let config = configContext.config;
    // @ts-ignore
    config.buildSettings.operatorConfig.updateGraph = val;
    configContext.setConfig(config);
    setUpdateGraphTypeOpen(false);
  }

  function toggleUpdateGraphType(open) {
    setUpdateGraphTypeOpen(open);
  }

  const NestedBuildOptions = () => {
    if (configContext.config.buildSettings?.buildPromotes) {
      return (
        <React.Fragment>
          <Checkbox
            className="nested"
            isChecked={configContext.config.buildSettings?.partOfOSRelease}
            name="partOfOSRelease"
            label="This repository promotes images as part of the OpenShift release?"
            id="partOfOSRelease"
            key="partOfOSRelease"
            value="partOfOSRelease"
            isDisabled={!configContext.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
          <Checkbox
            className="nested"
            isChecked={configContext.config.buildSettings?.needsBase}
            name="needsBase"
            label="One or more images build on top of the OpenShift base image?"
            id="needsBase"
            key="needsBase"
            value="needsBase"
            isDisabled={!configContext.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
          <Checkbox
            className="nested"
            isChecked={configContext.config.buildSettings?.needsOS}
            name="needsOS"
            label="One or more images build on top of the CentOS base image?"
            id="needsOS"
            key="needsOS"
            value="needsOS"
            isDisabled={!configContext.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
        </React.Fragment>
      );
    } else {
      return <React.Fragment/>
    }
  }

  const CompileOptions = () => {
    return (
      <React.Fragment>
        <FormGroup
          label="What version of Go does the repository build with?"
          isRequired
          fieldId="goVersion">
          <TextInput
            name="goVersion"
            id="goVersion"
            key="goVersion"
            value={configContext.config.buildSettings?.goVersion || ''}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="Enter the Go import path for the repository if it uses a vanity URL (e.g. 'k8s.io/my-repo'):"
          fieldId="canonicalGoRepository">
          <TextInput
            name="canonicalGoRepository"
            id="canonicalRepository"
            key="canonicalRepository"
            value={configContext.config.buildSettings?.canonicalGoRepository || ''}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="What commands are used to build binaries? (e.g. 'go build ./cmd/...'). This will get built as the pipeline:bin image."
          isRequired
          fieldId="buildCommands">
          <TextInput
            name="buildCommands"
            id="buildCommands"
            key="buildCommands"
            value={configContext.config.buildSettings?.buildCommands || ''}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="What commands are used to build test binaries? (e.g. 'go test -c ./test/...'). This will get built as the pipeline:test-bin image."
          isRequired
          fieldId="testBuildCommands">
          <TextInput
            name="testBuildCommands"
            id="testBuildCommands"
            key="testBuildCommands"
            value={configContext.config.buildSettings?.testBuildCommands || ''}
            onChange={handleChange}
          />
        </FormGroup>
      </React.Fragment>);
  }

  const OperatorOptions = () => {
    return (
      <Card>
        <CardTitle>Operator Config</CardTitle>
        <CardBody>
          <Checkbox
            isChecked={configContext.config.buildSettings?.operatorConfig?.isOperator}
            name="operatorConfig.isOperator"
            label="This is an optional operator build."
            id="operatorConfig.isOperator"
            value="isOperator"
            key="operatorConfig.isOperator"
            onChange={handleChange}
          />
          {OperatorSubfields()}
        </CardBody>
      </Card>);
  }

  const OperatorSubfields = () => {
    if (configContext.config.buildSettings?.operatorConfig?.isOperator) {
      return (
        <React.Fragment>
          <FormGroup
            label="The image name for the built bundle. Specifying a name for the bundle image allows a multistage workflow directly access the bundle by name. If not provided, a dynamically generated name will be created for the bundle and the bundle will only be accessible via the default index image (ci-index)"
            fieldId="operatorConfig.name">
            <TextInput
              name="operatorConfig.name"
              id="operatorConfig.name"
              key="operatorConfig.name"
              value={configContext.config.buildSettings?.operatorConfig?.name || ''}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Path to the Dockerfile that builds the bundle image, defaulting to bundle.Dockerfile"
            fieldId="operatorConfig.dockerfilePath">
            <TextInput
              name="operatorConfig.dockerfilePath"
              id="operatorConfig.dockerfilePath"
              key="operatorConfig.dockerfilePath"
              value={configContext.config.buildSettings?.operatorConfig?.dockerfilePath || ''}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Base directory for the bundle image build, defaulting to the root of the source tree, defaulting to ."
            fieldId="operatorConfig.contextDir">
            <TextInput
              name="operatorConfig.contextDir"
              id="operatorConfig.contextDir"
              key="operatorConfig.contextDir"
              value={configContext.config.buildSettings?.operatorConfig?.contextDir || ''}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="The base index to add the bundle to. If set, image must be specified in base_images or images. If unspecified, the bundle will be added to an empty index. Requires as to be set."
            fieldId="operatorConfig.baseIndex">
            <TextInput
              name="operatorConfig.baseIndex"
              id="operatorConfig.baseIndex"
              key="operatorConfig.baseIndex"
              value={configContext.config.buildSettings?.operatorConfig?.baseIndex || ''}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="The update mode to use when adding the bundle to the base_index. Can be: semver, semver-skippatch, or replaces (default: semver). Requires base_index to be set."
            fieldId="operatorConfig.targetNamespaces">
            <Select
              name="operatorConfig.targetNamespaces"
              id="operatorConfig.targetNamespaces"
              key="operatorConfig.targetNamespaces"
              value={configContext.config.buildSettings?.operatorConfig?.updateGraph}
              variant={SelectVariant.single}
              isOpen={updateGraphTypeOpen}
              onToggle={toggleUpdateGraphType}
              onSelect={changeUpdateGraphType}
              selections={configContext.config.buildSettings?.operatorConfig?.updateGraph}>
              {Object.keys(UpdateGraphType).filter(k => isNaN(Number(k))).map((val, index) => (
                <SelectOption
                  key={index}
                  value={val}
                />
              ))}
            </Select>
          </FormGroup>
          <br/>
          <br/>
          <PullspecSubstitutions/>
        </React.Fragment>
      );
    } else {
      return <React.Fragment/>
    }
  }

  return (
    <React.Fragment>
      <Card>
        <CardTitle>General Build Options</CardTitle>
        <CardBody>
          <ErrorMessage messages={context.step.errorMessages}/>
          <Checkbox
            isChecked={configContext.config.buildSettings?.buildPromotes}
            name="buildPromotes"
            label="Does the repository build and promote container images?"
            id="buildPromotes"
            key="buildPromotes"
            onChange={handleChange}
          />
          {NestedBuildOptions()}
          {CompileOptions()}
        </CardBody>
      </Card>
      <BaseImages/>
      {OperatorOptions()}
    </React.Fragment>
  );
}

export {RepoBuildConfig}
