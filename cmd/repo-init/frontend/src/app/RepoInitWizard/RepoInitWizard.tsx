import React, {useContext, useState} from 'react';
import {Button, Wizard, WizardContextConsumer, WizardFooter} from '@patternfly/react-core';
import {RepoBuildConfig} from "@app/BuildConfig/BuildConfig";
import {RepoInfo} from "@app/RepoInfo/RepoInfo";
import {RepoJobConfig} from "@app/JobConfig/JobConfig";
import {AuthContext, RepoConfigInterface, WizardContext, WizardStep} from "@app/types";
import {Finalize} from "@app/Finalize/Finalize";
import {Redirect} from "react-router-dom";

const RepoInitWizard: React.FunctionComponent = () => {
  const auth = useContext(AuthContext)
  const [step, setStep] = useState({} as WizardStep);
  const [config, setConfig] = useState({
    tests: [],
    e2eTests: [],
    buildSettings: {
      operatorSettings: {
        isOperator: false
      }
    }
  } as RepoConfigInterface)
  const [stepIdReached, setStepIdReached] = useState(1);

  if (!auth.userData.isAuthenticated) {
    return <Redirect to="/login"/>;
  }

  const onNext = ({id, name, prevId, prevName}) => {
    setStepIdReached(stepIdReached < id ? id : stepIdReached);
  };

  const goNext = (onNext) => {
    if (step.stepIsComplete) {
      onNext();
    }
  }

  const CustomFooter = (
    <WizardFooter>
      <WizardContextConsumer>
        {({activeStep, goToStepByName, goToStepById, onNext, onBack, onClose}) => {
          if (activeStep.name !== 'Verify') {
            return (
              <div>
                <Button variant="primary" type="submit" isDisabled={!step.stepIsComplete}
                        onClick={() => goNext(onNext)}>
                  Next
                </Button>
                <Button variant="secondary" onClick={onBack}
                        className={activeStep.name === 'Repo Information' ? 'pf-m-disabled' : ''}>
                  Back
                </Button>
                <Button variant="link" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            )
          } else {
            // Final step buttons
            return (
              <div>
                <Button variant="secondary" onClick={onBack}
                        className={activeStep.name === 'Repo Information' ? 'pf-m-disabled' : ''}>
                  Back
                </Button>
              </div>
            )
          }
        }}
      </WizardContextConsumer>
    </WizardFooter>
  );

  const steps = [
    {id: 1, name: 'Repo Information', component: <RepoInfo/>},
    {id: 2, name: 'Build Config', component: <RepoBuildConfig/>, canJumpTo: stepIdReached >= 2},
    {id: 3, name: 'Job Config', component: <RepoJobConfig/>, canJumpTo: stepIdReached >= 3},
    {id: 4, name: 'Verify', component: <Finalize/>, canJumpTo: stepIdReached >= 4}
  ];
  const title = 'Repo Config Wizard';
  return <WizardContext.Provider value={{config: config, step: step, setStep: setStep, setConfig: setConfig}}>
    <Wizard
      navAriaLabel={`${title} steps`}
      mainAriaLabel={`${title} content`}
      steps={steps}
      footer={CustomFooter}
      onNext={onNext}/>
  </WizardContext.Provider>
}

export default RepoInitWizard
