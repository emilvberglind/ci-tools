import React, {useContext} from 'react';
import {ActionGroup, Button, Checkbox, Form, FormGroup, TextInput} from '@patternfly/react-core';
import {Caption, TableComposable, Tbody, Td, Th, Thead, Tr} from '@patternfly/react-table';
import {Test, WizardContext} from "@app/types";
import {ErrorMessage} from "@app/Common/Messaging";

const RepoJobConfig: React.FunctionComponent = () => {
  const context = useContext(WizardContext);

  const [curTest, setCurTest] = React.useState({testCommands: 'make test-unit'} as Test)
  const columns = ['Name', 'Requires Binaries', 'Requires Test Binaries', 'Test Commands', '']

  function saveTest() {
    let tests = context.config.tests;
    if (tests.find(t => (t.name.toLowerCase() === curTest.name.toLowerCase())) === undefined) {
      tests.push(curTest);
      context.setConfig({...context.config, tests: tests});
      setCurTest({name:'', testCommands: 'make test-unit'} as Test);
    } else {
      context.setStep({...context.step, errorMessage: "A test with that name already exists"});
    }
  }

  function editTest(index) {
    setCurTest(context.config.tests[index]);
  }

  function removeTest(index) {
    let tests = context.config.tests;
    tests.splice(index, 1);
    context.setConfig({...context.config, tests: tests});
  }

  function handleChange(val, evt) {
    curTest[evt.target.name] = val;
    setCurTest({...curTest, [evt.target.name]: val});
  }

  return <React.Fragment>
    <Form>
      <FormGroup fieldId="testName"
                 label="Test Name">
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
                 label="What commands in the repository run the test?">
        <TextInput
          id="testCommands"
          name="testCommands"
          onChange={handleChange}
          value={curTest.testCommands}/>
      </FormGroup>
      <ErrorMessage errorMsg={context.step.errorMessage}/>
      <ActionGroup>
        <Button variant="primary" onClick={saveTest}>Save Test</Button>
        {/*<Button variant="link">Cancel</Button>*/}
      </ActionGroup>
    </Form>
    <TableComposable
      aria-label="Test Jobs">
      <Caption>Simple table using composable components</Caption>
      <Thead>
        <Tr>
          {columns.map((column, columnIndex) => (
            <Th key={columnIndex}>{column}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {context.config.tests.filter(row => (row.name !== curTest.name)).map((row, rowIndex) => (
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

export {RepoJobConfig}
