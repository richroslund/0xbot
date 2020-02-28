import React from 'react';
import { render } from 'ink';
import { App } from './App';
export const startCLI = async () => {
  return render(<App />);
};
