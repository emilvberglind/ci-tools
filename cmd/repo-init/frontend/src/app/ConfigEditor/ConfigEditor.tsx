import React, {useContext, useEffect, useState} from "react";
import {CodeEditor, Language} from "@patternfly/react-code-editor";
import {convertConfig} from "@app/utils/utils";
import {ConfigContext} from "@app/types";

export interface ConfigEditorProps {
  readOnly: boolean;
}

const ConfigEditor: React.FunctionComponent<ConfigEditorProps> = ({readOnly}) => {
  const [configYaml, setConfigYaml] = useState("");
  const configContext = useContext(ConfigContext);

  useEffect(() => {
    convertConfig(configContext.config).then(yaml => {
      return setConfigYaml(yaml!);
    }).catch((e) => {
      return setConfigYaml("An error occurred loading the config");
    });
  }, []);

  return (
    <CodeEditor
      isReadOnly={readOnly}
      // isMinimapVisible={isMinimapVisible}
      code={configYaml}
      // onChange={this.onChange}
      language={Language.yaml}
      // onEditorDidMount={this.onEditorDidMount}
      height='800px'
    />
  );
}

export {ConfigEditor};
