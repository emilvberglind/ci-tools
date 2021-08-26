import {createContext} from 'react';

export const initialState = {
  isAuthenticated: false,
  token: null,
  client_id: process.env.REACT_APP_CLIENT_ID,
  redirect_uri: process.env.REACT_APP_REDIRECT_URI,
  client_secret: process.env.REACT_APP_CLIENT_SECRET,
  proxy_url: process.env.REACT_APP_PROXY_URL
};

export interface UserData {
  isAuthenticated: boolean;
  token?: string;
}

export interface AuthContext {
  userData: UserData;
  updateContext?: any;
}

export interface RepoConfigInterface {
  org?: string;
  repo?: string;
  branch?: string;
  buildSettings?: RepoConfigBuildSettings;
  tests: Test[];
  e2eTests: E2eTest[];
}

export interface RepoConfigBuildSettings {
  buildPromotes?: boolean;
  partOfOSRelease?: boolean;
  needsBase?: boolean;
  needsOS?: boolean;
  goVersion?: string;
  goImportPath?: string;
  canonicalGoRepository?: string;
  buildCommands?: string;
  testBuildCommands?: string;
  operatorSettings?: OperatorSettings
}

export interface OperatorSettings {
  isOperator: boolean;
  name?: string;
  dockerfilePath?: string;
  contextDir?: string;
  baseIndex?: string;
  package?: string;
  channel?: string;
  installNamespace?: string;
  targetNamespaces?: string;
  updateGraph?: UpdateGraphType;
  substitutions?: ImageSubstitutions[]
}

export interface ImageSubstitutions {
  pullspec: string;
  with: string;
}

export interface WizardStep {
  step?: number;
  stepIsComplete?: boolean;
  errorMessage?: string;
}

export interface WizardContextInterface {
  config: RepoConfigInterface;
  step: WizardStep;
  setStep?: any;
  setConfig?: any;
}

export const WizardContext = createContext({} as WizardContextInterface);
export const AuthContext = createContext({userData: {isAuthenticated: false}} as AuthContext);

export type Test = {
  name: string;
  requiresBuiltBinaries?: boolean;
  requiresTestBinaries?: boolean;
  testCommands?: string;
}

export type E2eTest = {
  name: string;
  requiresCli: boolean;
  testCommands: string;
  cloudProvider?: CloudProvider;
  // env: KeyValuePair[];
  // dependencies: KeyValuePair[];
}

// export type KeyValuePair = {
//   key: string;
//   value: string;
// }

export enum CloudProvider {
  Aws,
  Azure,
  Gcp
}

export enum OperatorParams {
  channel,
  installNamespace,
  package,
  targetNamespaces,
  indexName
}

export enum UpdateGraphType {
  semver,
  semverSkippatch,
  replaces,

}
