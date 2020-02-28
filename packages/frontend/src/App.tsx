import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { Navbar } from './nav/Navbar';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Staking } from './pages/Staking';
import { WalletPicker } from './components/WalletPicker';
import { WalletType } from './types';
import { Web3Provider } from './hooks/useWeb3';

export const App: React.FC<{}> = () => {
  const [wallet, setWallet] = useState<WalletType>();
  const trySetWalletType = useCallback((value: any) => {
    if (value === 'walletconnect') {
      setWallet('walletconnect');
    } else {
      setWallet('web3');
    }
  }, []);
  return (
    <Router>
      <div className="App">
        {/* <Navbar> */}
        <WalletPicker onChange={trySetWalletType} />
        {wallet && (
          <Web3Provider type={wallet}>
            <Switch>
              <Route path="/stake">
                <Staking />
              </Route>
              <Route exact path="/">
                <Home />
              </Route>
              {/* <Route path="/stake">
                    </Route> */}
            </Switch>
          </Web3Provider>
        )}
        {/* </Navbar> */}
      </div>
    </Router>
  );
};
