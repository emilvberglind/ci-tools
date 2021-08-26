import React, {useContext} from 'react';
import {FormGroup, TextInput} from '@patternfly/react-core';
import {WizardContext} from "@app/types";
import {ErrorMessage} from "@app/Common/Messaging"

const RepoInfo: React.FunctionComponent = () => {
  const context = useContext(WizardContext);

  const handleChange = (checked, event) => {
    const target = event.target;
    const name = target.name;
    context.setConfig({...context.config, [name]: target.value});
  };

  function onBlur(evt) {
    let config = context.config;
    config[evt.target.name] = evt.target.value;

    if (config.org && config.repo && config.branch) {
      validate()
    }
  }

  function validate() {
    let config = context.config;
    fetch('http://localhost:8080/api/configs?org=' + config.org + '&repo=' + config.repo)
      .then((r) => {
        if (r.status === 404) {
          context.setStep({...context.step, errorMessage: "", stepIsComplete: true});
        } else {
          context.setStep({
            ...context.step,
            errorMessage: "It looks like there's already a configuration for that org and repo combination.",
            stepIsComplete: false
          });
        }
      })
      .catch((e) => {
        context.setStep({
          ...context.step,
          errorMessage: "An error occurred while validating if this configuration already exists.",
          stepIsComplete: false
        });
      });
  }

  return <React.Fragment>
    <FormGroup
      label="Repo Organization"
      isRequired
      fieldId="org">
      <TextInput
        isRequired
        type="text"
        id="org"
        name="org"
        onBlur={onBlur}
        onChange={handleChange}
        value={context.config.org}
      />
    </FormGroup>
    <FormGroup
      label="Repo Name"
      isRequired
      fieldId="repo">
      <TextInput
        isRequired
        type="text"
        id="repo"
        name="repo"
        onBlur={onBlur}
        onChange={handleChange}
        value={context.config.repo}
      />
    </FormGroup>
    <FormGroup
      label="Development Branch"
      isRequired
      fieldId="branch">
      <TextInput
        isRequired
        type="text"
        id="branch"
        name="branch"
        defaultValue="master"
        onBlur={onBlur}
        onChange={handleChange}
        value={context.config.branch}
      />
    </FormGroup>
    <ErrorMessage errorMsg={context.step.errorMessage}/>
  </React.Fragment>


}

export {RepoInfo}
