import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppLayout } from '@app/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import {AuthContext, initialState} from '@app/types'
import '@app/app.css';
import {useState} from "react";

const App: React.FunctionComponent = () => {
  const [auth, setAuth] = useState({isAuthenticated: initialState.isAuthenticated, user: initialState.user});

  return <AuthContext.Provider value={{userData: auth, updateContext: setAuth}}>
    <Router>
      <AppLayout>
        <AppRoutes/>
      </AppLayout>
    </Router>
  </AuthContext.Provider>
};

export default App;
