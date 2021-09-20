import React, {useContext, useState} from "react";
import {TableComposable, Tbody, Td, Th, Thead, Tr} from "@patternfly/react-table";
import {ActionGroup, Button, FormGroup, Text, TextContent, TextInput, TextVariants} from "@patternfly/react-core";
import {ConfigContext, PullspecSubstitution, setVal, WizardContext} from "@app/types";
import {ErrorMessage} from "@app/Common/Messaging";
import {validateConfig} from "@app/utils/utils";

const PullspecSubstitutions: React.FunctionComponent = () => {
  const columns = ['Pullspec', 'With', '']
  const context = useContext(WizardContext);
  const configContext = useContext(ConfigContext);

  const [curSubstitution, setCurSubstitution] = useState({} as PullspecSubstitution)
  const [errorMessage, setErrorMessage] = useState([] as string[])

  function handleChange(val, evt) {
    let updated = {...curSubstitution}
    setVal(updated, evt.target.name, val);
    setCurSubstitution(updated);
  }

  function saveSubstitution() {
    let config = configContext.config;
    let operatorConfig = config.buildSettings?.operatorConfig;
    if (!operatorConfig) {
      operatorConfig = {isOperator: true, substitutions: []}
    }
    if (operatorConfig.substitutions.find(t => (t.pullspec.toLowerCase() === curSubstitution.pullspec.toLowerCase())) === undefined) {
      let substitutionObj = {substitution: {...curSubstitution}}
      validate(config, substitutionObj, () => {
        operatorConfig!.substitutions.push(curSubstitution);
        configContext.setConfig(config);
        setCurSubstitution({} as PullspecSubstitution);
      });
    } else {
      context.setStep({...context.step, errorMessages: ["A substitution for that pullspec already exists"]});
    }
  }

  function validate(validationConfig, substitution, onSuccess) {
    validateConfig('OPERATOR_SUBSTITUTION', validationConfig, substitution)
      .then((validationState) => {
        if (validationState.valid) {
          onSuccess();
          setErrorMessage([]);
          context.setStep({...context.step, errorMessage: "", stepIsComplete: true});
        } else {
          setErrorMessage(validationState.errors != undefined ? validationState.errors.map(error => error.message) : [""]);
          context.setStep({
            ...context.step,
            stepIsComplete: false
          });
        }
      })
  }

  function removeSubstitution(index) {
    let config = configContext.config;
    let operatorConfig = config.buildSettings?.operatorConfig;
    if (operatorConfig) {
      operatorConfig.substitutions.splice(index, 1);
      configContext.setConfig(config);
    }
  }

  return (
    <React.Fragment>
      <TextContent>
        <Text component={TextVariants.h5}><strong>Pullspec Substitutions</strong></Text>
      </TextContent>
      <br/>
      <FormGroup
        label="Pullspec to replace"
        fieldId="pullspec">
        <TextInput
          name="pullspec"
          id="pullspec"
          value={curSubstitution.pullspec || ''}
          onChange={handleChange}
        />
      </FormGroup>
      <FormGroup
        label="What should the pullspec be replaced with?"
        fieldId="with">
        <TextInput
          name="with"
          id="with"
          value={curSubstitution.with || ''}
          onChange={handleChange}
        />
      </FormGroup>
      <br/>
      <ErrorMessage messages={errorMessage}/>
      <ActionGroup>
        <Button variant="primary" onClick={saveSubstitution}>Add Substitution</Button>
      </ActionGroup>
      <TableComposable aria-label="Pullspec Substitutions">
        <Thead>
          <Tr>
            {columns.map((column, columnIndex) => (
              <Th key={columnIndex}>{column}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {configContext.config.buildSettings?.operatorConfig?.substitutions?.map((row, rowIndex) => (
            <Tr key={rowIndex}>
              <Td key={`${rowIndex}_${0}`} dataLabel={columns[0]}>
                {row.pullspec}
              </Td>
              <Td key={`${rowIndex}_${1}`} dataLabel={columns[1]}>
                {row.with}
              </Td>
              <Td key={`${rowIndex}_${2}`} dataLabel={columns[2]}>
                <ActionGroup>
                  <Button variant="danger" onClick={() => removeSubstitution(rowIndex)}>Delete</Button>
                </ActionGroup>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </TableComposable>
    </React.Fragment>)
}

export {PullspecSubstitutions}
