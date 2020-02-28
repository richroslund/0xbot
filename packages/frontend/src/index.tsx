import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { App } from './App';
import { createStore, applyMiddleware, compose } from 'redux';
import * as serviceWorker from './serviceWorker';
import { Provider } from 'react-redux';
import { reducer } from './state/state';
import { composeWithDevTools } from 'redux-devtools-extension';
import thunk from 'redux-thunk';
const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
//const composeEnhancers = composeWithDevTools(applyMiddleware(...[thunk]));
const store = createStore(reducer, composeEnhancers(applyMiddleware(...[thunk])));

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
