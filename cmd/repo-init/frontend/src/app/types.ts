import {createContext} from 'react';

export const ghAuthState = {
  isAuthenticated: false,
  token: null,
  client_id: process.env.REACT_APP_CLIENT_ID,
  redirect_uri: process.env.REACT_APP_REDIRECT_URI,
  client_secret: process.env.REACT_APP_CLIENT_SECRET,
  proxy_url: process.env.REACT_APP_PROXY_URL
};

export interface ValidationStateInterface {
  valid?: boolean;
  errorMessage?: string
  errors?: ValidationError[]

  getErrorMessage(): string
}

export interface ValidationError {
  key: string;
  field?: string;
  message: string;
}

export class ValidationState implements ValidationStateInterface {
  valid?: boolean;
  errorMessage?: string
  errors?: ValidationError[]

  getErrorMessage(): string {
    if (this.errorMessage !== undefined) {
      return this.errorMessage;
    } else {
      return "";
    }
  }
}

export interface UserData {
  isAuthenticated: boolean;
  token?: string;
  userName?: string;
}

export interface AuthContextInterface {
  userData: UserData;
  updateContext?: any;
}

export interface RepoConfigInterface {
  org?: string;
  repo?: string;
  branch?: string;
  buildSettings: RepoConfigBuildSettings;
  tests: Test[];
}

export interface RepoConfigBuildSettings {
  buildPromotes?: boolean;
  partOfOSRelease?: boolean;
  needsBase?: boolean;
  needsOS?: boolean;
  goVersion?: string;
  canonicalGoRepository?: string;
  baseImages?: Image[];
  buildCommands?: string;
  testBuildCommands?: string;
  operatorConfig?: OperatorConfig
  release: ReleaseConfig
}

export interface OperatorConfig {
  isOperator: boolean;
  name?: string;
  dockerfilePath?: string;
  contextDir?: string;
  baseIndex?: string;
  updateGraph?: UpdateGraphType;
  substitutions: PullspecSubstitution[]
}

export interface ReleaseConfig {
  type: ReleaseType;
  version?: string;
}

export interface Image {
  name: string;
  namespace: string;
  tag: string;
}

export interface PullspecSubstitution {
  pullspec: string;
  with: string;
}

export interface WizardStep {
  step?: number;
  stepIsComplete?: boolean;
  errorMessages?: string[];
}

export interface WizardContextInterface {
  step: WizardStep;
  setStep?: any;
}

export interface ConfigContextInterface {
  config: RepoConfigInterface;
  setConfig?: any;
}

export const ConfigContext = createContext({} as ConfigContextInterface)
export const WizardContext = createContext({} as WizardContextInterface);
export const AuthContext = createContext({userData: {isAuthenticated: false}} as AuthContextInterface);

export type Test = {
  name: string;
  requiresBuiltBinaries?: boolean;
  requiresTestBinaries?: boolean;
  testCommands?: string;
  type: TestType;
  requiresCli: boolean;
  cloudProvider?: CloudProvider;
  operatorConfig?: OperatorTestConfig;
  env: { [env: string]: string };
  dependencies: { [env: string]: string };
}

export type OperatorTestConfig = {
  bundleName?: string;
  package?: string;
  channel?: string;
  installNamespace?: string;
  targetNamespaces?: string;
}

export enum TestType {
  Unit = 'Unit',
  E2e = 'E2e',
  Operator = 'Operator'
}

export enum CloudProvider {
  Aws = 'Aws',
  Azure = 'Azure',
  Gcp = 'Gcp'
}

export enum OperatorParams {
  channel,
  installNamespace,
  package,
  targetNamespaces,
  indexName
}

export enum UpdateGraphType {
  semver = 'semver',
  semverSkippatch = 'semver_skippatch',
  replaces = 'release',

}

export enum ReleaseType {
  No = 'No',
  Published = 'Published',
  Nightly = 'Nightly'
}

export function setVal(obj, is, value) {
  if (typeof is == 'string')
    return setVal(obj, is.split('.'), value);
  else if (is.length == 1 && value !== undefined)
    return obj[is[0]] = value;
  else if (is.length == 0)
    return obj;
  else
    return setVal(obj[is[0]], is.slice(1), value);
}
