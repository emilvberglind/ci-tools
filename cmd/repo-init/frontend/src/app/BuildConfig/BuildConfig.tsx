import React, {useContext, useEffect} from 'react';
import {Checkbox, FormGroup, TextInput} from '@patternfly/react-core';
import {WizardContext} from "@app/types";

const RepoBuildConfig: React.FunctionComponent = () => {
  const context = useContext(WizardContext);

  // useEffect(() => {
  //   if (!context.config.buildSettings?.buildPromotes) {
  //     context.setConfig({
  //       ...context.config, buildSettings: {
  //         partOfOSRelease: false,
  //         needsBase: false,
  //         needsOS: false
  //       }
  //     });
  //   }
  // }, [context.config.buildSettings?.buildPromotes]);

  const handleChange = (val, event) => {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    let updatedBuildSettings = context.config.buildSettings;
    setVal(updatedBuildSettings, target.name, value);
    context.setConfig({...context.config, buildSettings: updatedBuildSettings});
  };

  function setVal(obj,is, value) {
    if (typeof is == 'string')
      return setVal(obj,is.split('.'), value);
    else if (is.length==1 && value!==undefined)
      return obj[is[0]] = value;
    else if (is.length==0)
      return obj;
    else
      return setVal(obj[is[0]],is.slice(1), value);
  }

  const renderNestedBuildOptions = () => {
    if (context.config.buildSettings?.buildPromotes) {
      return (
        <React.Fragment>
          <Checkbox
            className="nested"
            isChecked={context.config.buildSettings?.partOfOSRelease}
            name="partOfOSRelease"
            label="This repository promotes images as part of the OpenShift release?"
            id="partOfOSRelease"
            value="partOfOSRelease"
            isDisabled={!context.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
          <Checkbox
            className="nested"
            isChecked={context.config.buildSettings?.needsBase}
            name="needsBase"
            label="One or more images build on top of the OpenShift base image?"
            id="needsBase"
            value="needsBase"
            isDisabled={!context.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
          <Checkbox
            className="nested"
            isChecked={context.config.buildSettings?.needsOS}
            name="needsOS"
            label="One or more images build on top of the CentOS base image?"
            id="needsOS"
            value="needsOS"
            isDisabled={!context.config.buildSettings?.buildPromotes}
            onChange={handleChange}
          />
        </React.Fragment>
      )
    } else {
      return <React.Fragment/>
    }
  }

  const renderCompileOptions = () => {
    return (
      <React.Fragment>
        <FormGroup
          label="What version of Go does the repository build with?"
          isRequired
          fieldId="goVersion">
          <TextInput
            name="goVersion"
            id="goVersion"
            defaultValue="1.13"
            value={context.config.buildSettings?.goVersion}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="Enter the Go import path for the repository if it uses a vanity URL (e.g. 'k8s.io/my-repo'):"
          isRequired
          fieldId="goImportPath">
          <TextInput
            name="goImportPath"
            id="goImportPath"
            value={context.config.buildSettings?.goImportPath}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="Enter the Go import path for the repository if it uses a vanity URL (e.g. 'k8s.io/my-repo'):"
          isRequired
          fieldId="canonicalGoRepository">
          <TextInput
            name="canonicalGoRepository"
            id="canonicalRepository"
            value={context.config.buildSettings?.canonicalGoRepository}
            onChange={handleChange}
          />
        </FormGroup>
        <FormGroup
          label="What commands are used to build test binaries? (e.g. 'go install -race ./cmd/...' or 'go test -c ./test/...')"
          isRequired
          fieldId="testBuildCommands">
          <TextInput
            name="testBuildCommands"
            id="testBuildCommands"
            value={context.config.buildSettings?.testBuildCommands}
            onChange={handleChange}
          />
        </FormGroup>
      </React.Fragment>
    )
  }

  const renderOperatorOptions = () => {
    if (context.config.buildSettings?.operatorSettings?.isOperator) {
      return (
        <React.Fragment>
          <FormGroup
            label="Bundle name. This is optional and will default to ci-index"
            fieldId="operatorSettings.name">
            <TextInput
              name="operatorSettings.name"
              id="operatorSettings.name"
              value={context.config.buildSettings?.operatorSettings?.name}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Bundle package name."
            fieldId="operatorSettings.package"
            isRequired>
            <TextInput
              name="operatorSettings.package"
              id="operatorSettings.package"
              value={context.config.buildSettings?.operatorSettings?.package}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Bundle channel."
            fieldId="operatorSettings.channel"
            isRequired>
            <TextInput
              name="operatorSettings.channel"
              id="operatorSettings.channel"
              value={context.config.buildSettings?.operatorSettings?.channel}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Bundle Install Namespace."
            fieldId="operatorSettings.installNamespace"
            isRequired>
            <TextInput
              name="operatorSettings.installNamespace"
              id="operatorSettings.installNamespace"
              value={context.config.buildSettings?.operatorSettings?.installNamespace}
              onChange={handleChange}
            />
          </FormGroup>
          <FormGroup
            label="Bundle target namespaces."
            fieldId="operatorSettings.targetNamespaces"
            isRequired>
            <TextInput
              name="operatorSettings.targetNamespaces"
              id="operatorSettings.targetNamespaces"
              value={context.config.buildSettings?.operatorSettings?.targetNamespaces}
              onChange={handleChange}
            />
          </FormGroup>
        </React.Fragment>
      )
    } else {
      return (
        <React.Fragment/>
      )
    }
  }

  return (
    <React.Fragment>
      <Checkbox
        isChecked={context.config.buildSettings?.buildPromotes}
        name="buildPromotes"
        label="Does the repository build and promote container images?"
        id="buildPromotes"
        value="buildPromotes"
        onChange={handleChange}
      />
      {renderNestedBuildOptions()}
      {renderCompileOptions()}
      <Checkbox
        isChecked={context.config.buildSettings?.operatorSettings?.isOperator}
        name="operatorSettings.isOperator"
        label="This is an optional operator build."
        id="operatorSettings.isOperator"
        value="isOperator"
        onChange={handleChange}
      />
      {renderOperatorOptions()}
    </React.Fragment>
  );
}

export {RepoBuildConfig}
