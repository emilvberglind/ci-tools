import React, {useContext, useEffect, useState} from 'react';
import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Form,
  FormGroup,
  Popover,
  Select,
  SelectOption,
  SelectVariant,
  TextInput
} from '@patternfly/react-core';
import {Caption, TableComposable, Tbody, Td, Th, Thead, Tr} from '@patternfly/react-table';
import {ConfigContext, ReleaseType, setVal, Test, TestType, WizardContext} from "@app/types";
import {ErrorMessage} from "@app/Common/Messaging";
import HelpIcon from '@patternfly/react-icons/dist/js/icons/help-icon';
import {testTypeHelpText} from "@app/Common/helpText";
import {validateConfig} from "@app/utils/utils";

const TestConfig: React.FunctionComponent = () => {
  const context = useContext(WizardContext);
  const configContext = useContext(ConfigContext);

  const [curTest, setCurTest] = useState({
    type: TestType.Unit,
    testCommands: '',
    operatorConfig: {}
  } as Test)
  const [typeOpen, setTypeOpen] = useState(false);
  const [releaseTypeOpen, setReleaseTypeOpen] = useState(false);
  const columns = ['Name', 'Requires Binaries', 'Requires Test Binaries', 'Test Commands', '']

  useEffect(() => {
    validate();
  }, []);

  function validate() {
    if (configContext.config.tests.length > 0) {
      context.setStep({
        ...context.step,
        stepIsComplete: true,
        errorMessages: []
      });
    } else {
      context.setStep({
        ...context.step,
        stepIsComplete: false,
        errorMessages: []
      });
    }
  }

  function saveTest() {
    let tests = configContext.config.tests;
    if (tests.find(t => (t.name.toLowerCase() === curTest.name.toLowerCase())) === undefined) {
      if (curTest.name.trim() !== "" && curTest.testCommands !== "") {
        let updatedTests = configContext.config.tests.concat(curTest);
        let validationConfig = {...configContext.config, tests: updatedTests};

        validateConfig('TESTS', validationConfig, {})
          .then((validationState) => {
            if (validationState.valid) {
              tests.push(curTest);
              configContext.setConfig({...configContext.config, tests: tests});
              setCurTest({name: '', type: TestType.Unit, testCommands: '', operatorConfig: {}} as Test);
              context.setStep({...context.step, errorMessages: [], stepIsComplete: true});
            } else {
              context.setStep({
                ...context.step,
                errorMessages: validationState.errors != undefined ? validationState.errors.map(error => error.message) : [""],
                stepIsComplete: false
              });
            }
          })

      } else {
        context.setStep({
          ...context.step,
          errorMessages: ["You must, at a minimum, provide a name and the commands to run."]
        });
      }
    } else {
      context.setStep({...context.step, errorMessages: ["A test with that name already exists."]});
    }
    validate();
  }

  function editTest(index) {
    setCurTest(configContext.config.tests[index]);
  }

  function removeTest(index) {
    let tests = configContext.config.tests;
    tests.splice(index, 1);
    configContext.setConfig({...configContext.config, tests: tests});
  }

  function handleChange(val, evt) {
    let updated = {...curTest};
    setVal(updated, evt.target.name, val);
    setCurTest(updated);
  }

  function changeTestType(e, val) {
    setCurTest({...curTest, type: val});
    setTypeOpen(false);
  }

  function toggleTestType(open) {
    setTypeOpen(open);
  }

  function changeReleaseVersion(val) {
    let buildSettings = {...configContext.config.buildSettings}
    buildSettings.release.version = val;
    configContext.setConfig({...configContext.config, buildSettings: buildSettings});
  }

  function changeReleaseType(e, val) {
    let buildSettings = {...configContext.config.buildSettings}
    buildSettings.release.type = val;
    configContext.setConfig({...configContext.config, buildSettings: buildSettings});
    setReleaseTypeOpen(false);
  }

  function toggleReleaseType(open) {
    setReleaseTypeOpen(open);
  }

  const TypeSpecificElements = () => {
    if (curTest.type === TestType.Operator) {
      return (
        <Card>
          <CardTitle>Operator Settings</CardTitle>
          <CardBody>
            <FormGroup
              label="Bundle name. This is optional and will default to ci-index"
              fieldId="operatorConfig.bundleName">
              <TextInput
                name="operatorConfig.bundleName"
                id="operatorConfig.bundleName"
                value={curTest.operatorConfig?.bundleName || ''}
                onChange={handleChange}
              />
            </FormGroup>
            <FormGroup
              label="Bundle package name."
              fieldId="operatorConfig.package"
              isRequired>
              <TextInput
                name="operatorConfig.package"
                id="operatorConfig.package"
                value={curTest.operatorConfig?.package || ''}
                onChange={handleChange}
              />
            </FormGroup>
            <FormGroup
              label="Bundle channel."
              fieldId="operatorConfig.channel"
              isRequired>
              <TextInput
                name="operatorConfig.channel"
                id="operatorConfig.channel"
                value={curTest.operatorConfig?.channel || ''}
                onChange={handleChange}
              />
            </FormGroup>
            <FormGroup
              label="Bundle Install Namespace."
              fieldId="operatorConfig.installNamespace"
              isRequired>
              <TextInput
                name="operatorConfig.installNamespace"
                id="operatorConfig.installNamespace"
                value={curTest.operatorConfig?.installNamespace || ''}
                onChange={handleChange}
              />
            </FormGroup>
            <FormGroup
              label="Bundle target namespaces."
              fieldId="operatorConfig.targetNamespaces"
              isRequired>
              <TextInput
                name="operatorConfig.targetNamespaces"
                id="operatorConfig.targetNamespaces"
                value={curTest.operatorConfig?.targetNamespaces || ''}
                onChange={handleChange}
              />
            </FormGroup>
          </CardBody>
        </Card>
      )
    } else {
      return (
        <React.Fragment/>
      )
    }
  }

  const ReleaseFields = () => {
    if (configContext.config.buildSettings.release.type !== ReleaseType.No) {
      return (
        <FormGroup fieldId="version"
                   label="Release Version"
                   isRequired>
          <TextInput
            id="version"
            onChange={changeReleaseVersion}
            name="version"
            value={configContext.config.buildSettings.release.version}/>
        </FormGroup>
      )
    } else {
      return (
        <React.Fragment/>
      )
    }
  }

  return <React.Fragment>
    <FormGroup fieldId="release"
               label="Do any of the tests run on top of an openshift release?">
      <Select
        variant={SelectVariant.single}
        id="release"
        isOpen={releaseTypeOpen}
        onToggle={toggleReleaseType}
        onSelect={changeReleaseType}
        name="release"
        selections={configContext.config.buildSettings.release.type}>
        {Object.keys(ReleaseType).filter(k => isNaN(Number(k))).map((val, index) => (
          <SelectOption
            key={index}
            value={val}
          />
        ))}
      </Select>
    </FormGroup>
    {ReleaseFields()}
    <br/><br/>
    <Form>
      <FormGroup fieldId="type"
                 label="Type"
                 labelIcon={
                   <Popover
                     bodyContent={testTypeHelpText()}>
                     <button
                       type="button"
                       aria-label="More info for test type"
                       onClick={e => e.preventDefault()}
                       className="pf-c-form__group-label-help">
                       <HelpIcon noVerticalAlign/>
                     </button>
                   </Popover>
                 }>
        <Select
          variant={SelectVariant.single}
          id="type"
          isOpen={typeOpen}
          onToggle={toggleTestType}
          onSelect={changeTestType}
          name="type"
          selections={curTest.type}>
          {Object.keys(TestType).filter(k => isNaN(Number(k))).map((val, index) => (
            <SelectOption
              key={index}
              value={val}
            />
          ))}
        </Select>
      </FormGroup>
      <FormGroup fieldId="testName"
                 label="Test Name"
                 isRequired>
        <TextInput
          id="name"
          onChange={handleChange}
          name="name"
          value={curTest.name}/>
      </FormGroup>
      <Checkbox
        id="requiresBuiltBinaries"
        name="requiresBuiltBinaries"
        label="This test requires built binaries"
        onChange={handleChange}
        isChecked={curTest.requiresBuiltBinaries}
      />
      <Checkbox
        name="requiresTestBinaries"
        label="This test requires test binaries"
        id="requiresTestBinaries"
        onChange={handleChange}
        isChecked={curTest.requiresTestBinaries}/>
      <FormGroup fieldId="testCommands"
                 label="What commands in the repository run the test?"
                 helperText="These are the commands used to execute the tests against the repository. e.g. make test-unit">
        <TextInput
          id="testCommands"
          name="testCommands"
          onChange={handleChange}
          value={curTest.testCommands || ''}/>
      </FormGroup>
      <ErrorMessage messages={context.step.errorMessages}/>
      {TypeSpecificElements()}
      <ActionGroup>
        <Button variant="primary" onClick={saveTest}>Save Test</Button>
      </ActionGroup>
    </Form>
    <TableComposable
      aria-label="Test Jobs">
      <Caption>Existing Tests</Caption>
      <Thead>
        <Tr>
          {columns.map((column, columnIndex) => (
            <Th key={columnIndex}>{column}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {configContext.config.tests.filter(row => (row.name !== curTest.name)).map((row, rowIndex) => (
          <Tr key={rowIndex}>
            <Td key={`${rowIndex}_${0}`} dataLabel={columns[0]}>
              {row.name}
            </Td>
            <Td key={`${rowIndex}_${1}`} dataLabel={columns[1]}>
              {row.requiresBuiltBinaries ? "Yes" : "No"}
            </Td>
            <Td key={`${rowIndex}_${2}`} dataLabel={columns[2]}>
              {row.requiresTestBinaries ? "Yes" : "No"}
            </Td>
            <Td key={`${rowIndex}_${3}`} dataLabel={columns[3]}>
              {row.testCommands}
            </Td>
            <Td key={`${rowIndex}_${4}`} dataLabel={columns[4]}>
              <ActionGroup>
                <Button variant="primary" onClick={() => editTest(rowIndex)}>Edit</Button>
                <Button variant="danger" onClick={() => removeTest(rowIndex)}>Delete</Button>
              </ActionGroup>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </TableComposable>
  </React.Fragment>
}

export {TestConfig}
