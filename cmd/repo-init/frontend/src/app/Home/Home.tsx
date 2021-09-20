import * as React from 'react';
import {Flex, FlexItem, PageSection, Text, TextContent, TextVariants,} from '@patternfly/react-core';

const Home: React.FunctionComponent = () => {
  return <PageSection>
    <Flex direction={{default: 'column'}}
          justifyContent={{default: 'justifyContentSpaceAround'}}
          alignContent={{default: 'alignContentFlexStart'}}>
      <FlexItem>
        <TextContent>
          <Text component={TextVariants.h1}>New Repo Party Time</Text>
          <Text component={TextVariants.p}>Add text here. Blah blah blah. Say some neat stuff about the meaning of life.</Text>
        </TextContent>
      </FlexItem>
    </Flex>
  </PageSection>;
}

export {Home};
