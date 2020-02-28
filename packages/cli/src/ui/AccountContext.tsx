import React from 'react';

export const AccountContext = React.createContext<{ openOrders: number }>({ openOrders: 0 });
