import React, {useContext, useState} from "react";
import {TableComposable, Tbody, Td, Th, Thead, Tr} from "@patternfly/react-table";
import {
  ActionGroup,
  Button,
  Card,
  CardBody,
  CardTitle,
  FormGroup,
  Text,
  TextContent,
  TextInput,
  TextVariants
} from "@patternfly/react-core";
import {ConfigContext, Image, setVal, ValidationState, WizardContext} from "@app/types";
import {ErrorMessage} from "@app/Common/Messaging";
import {validateConfig} from "@app/utils/utils";

const BaseImages: React.FunctionComponent = () => {
  const columns = ['Name', 'Namespace', 'Tag', '']
  const context = useContext(WizardContext);
  const configContext = useContext(ConfigContext);

  const [curImage, setCurImage] = useState({} as Image)
  const [errorMessage, setErrorMessage] = useState([] as string[])

  function handleChange(val, evt) {
    let updated = {...curImage}
    setVal(updated, evt.target.name, val);
    setCurImage(updated);
  }

  function saveImage() {
    if (curImage.name && curImage.namespace && curImage.tag) {
      let config = configContext.config;
      let buildConfig = config.buildSettings;
      if (buildConfig) {
        if (!buildConfig.baseImages) {
          buildConfig.baseImages = [];
        }
        if (buildConfig.baseImages.find(t => (t.name.toLowerCase() === curImage.name.toLowerCase()) && (t.namespace.toLowerCase() === curImage.namespace.toLowerCase()) && (t.tag.toLowerCase() === curImage.tag.toLowerCase())) === undefined) {
          let updatedBaseImages = config!.buildSettings!.baseImages!.concat(curImage);
          let buildSettingsCopy = {...config.buildSettings, baseImages: updatedBaseImages}
          let validationConfig = {...config, buildSettings: buildSettingsCopy};
          validationConfig.buildSettings.baseImages.push(curImage);
          validate(validationConfig, () => {
            buildConfig!.baseImages!.push(curImage);
            configContext.setConfig(config);
            setErrorMessage([""]);
            setCurImage({} as Image);
          });
        } else {
          setErrorMessage(["That base image already exists"])
        }
      }
    } else {
      setErrorMessage(["Please provide a name, namespace, and tag for the image."])
    }
  }

  function validate(validationConfig, onSuccess) {
    validateConfig('BASE_IMAGES', validationConfig, {})
      .then((validationState) => {
        if (validationState.valid) {
          onSuccess();
          setErrorMessage([]);
          context.setStep({...context.step, errorMessages: [], stepIsComplete: true});
        } else {
          setErrorMessage(validationState.errors != undefined ? validationState.errors.map(error => error.message) : [""]);
          context.setStep({
            ...context.step,
            stepIsComplete: false
          });
        }
      })
  }

  function removeImage(index) {
    let config = configContext.config;
    let buildConfig = config.buildSettings;
    if (buildConfig && buildConfig.baseImages) {
      buildConfig.baseImages.splice(index, 1);
      configContext.setConfig(config);
    }
  }

  return <Card>
    <CardTitle>Base Images</CardTitle>
    <CardBody>
      <TextContent>
        <Text component={TextVariants.p}>This provides a mapping of named <i>ImageStreamTags</i> which will be available
          for use in container image builds.
          See <a href="https://docs.ci.openshift.org/docs/architecture/ci-operator/#configuring-inputs" target="_blank">Configuring
            Inputs</a>.</Text>
      </TextContent>
      <br/>
      <FormGroup
        label="Image Name"
        fieldId="name">
        <TextInput
          name="name"
          id="name"
          value={curImage.name}
          onChange={handleChange}
        />
      </FormGroup>
      <FormGroup
        label="Image Namespace"
        fieldId="namespace">
        <TextInput
          name="namespace"
          id="namespace"
          value={curImage.namespace}
          onChange={handleChange}
        />
      </FormGroup>
      <FormGroup
        label="Image Tag"
        fieldId="tag">
        <TextInput
          name="tag"
          id="tag"
          value={curImage.tag}
          onChange={handleChange}
        />
      </FormGroup>
      <br/>
      <ErrorMessage messages={errorMessage}/>
      <ActionGroup>
        <Button variant="primary" onClick={saveImage}>Add Base Image</Button>
      </ActionGroup>
      <TableComposable aria-label="Base Images">
        <Thead>
          <Tr>
            {columns.map((column, columnIndex) => (
              <Th key={columnIndex}>{column}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {configContext.config.buildSettings?.baseImages?.map((row, rowIndex) => (
            <Tr key={rowIndex}>
              <Td key={`${rowIndex}_${0}`} dataLabel={columns[0]}>
                {row.name}
              </Td>
              <Td key={`${rowIndex}_${1}`} dataLabel={columns[1]}>
                {row.namespace}
              </Td>
              <Td key={`${rowIndex}_${2}`} dataLabel={columns[2]}>
                {row.tag}
              </Td>
              <Td key={`${rowIndex}_${3}`} dataLabel={columns[3]}>
                <ActionGroup>
                  <Button variant="danger" onClick={() => removeImage(rowIndex)}>Delete</Button>
                </ActionGroup>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </TableComposable>
    </CardBody>
  </Card>
}

export {BaseImages}
