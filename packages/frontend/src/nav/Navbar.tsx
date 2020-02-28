import { Responsive, Visibility, Segment, Menu, Container, Button } from 'semantic-ui-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const getWidth = () => {
  return window.innerWidth;
};
export const Navbar: React.FC<{}> = ({ children }) => {
  const [fixed, setShowFixedMenu] = useState();
  return (
    <Responsive getWidth={getWidth} minWidth={Responsive.onlyTablet.minWidth}>
      <Visibility once={false} onBottomPassed={() => setShowFixedMenu(true)} onBottomPassedReverse={() => setShowFixedMenu(false)}>
        <Segment inverted textAlign="center" style={{ minHeight: 100, padding: '1em 0em' }} vertical>
          <Menu fixed={fixed ? 'top' : undefined} inverted={!fixed} pointing={!fixed} secondary={!fixed} size="large">
            <Container>
              <Menu.Item as="div" active>
                <Link to="/">Trade</Link>
              </Menu.Item>
              <Menu.Item as="div">
                <Link to="/stake">Stake</Link>
              </Menu.Item>
            </Container>
          </Menu>
        </Segment>
      </Visibility>

      {children}
    </Responsive>
  );
};
