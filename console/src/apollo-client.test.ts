import { gql } from '@apollo/client';
import { afterEach, describe, expect, it } from 'vitest';
import { apolloClient, clearGraphqlSessionCache } from './apollo-client';

const SESSION_QUERY = gql`
  query SessionCacheBoundaryTest {
    cases {
      edges {
        node {
          id
        }
      }
    }
  }
`;

describe('GraphQL session cache boundary', () => {
  afterEach(async () => {
    await clearGraphqlSessionCache();
  });

  it('removes tenant-shaped query results before another session renders', async () => {
    apolloClient.writeQuery({
      query: SESSION_QUERY,
      data: {
        cases: {
          __typename: 'CaseConnection',
          edges: [
            {
              __typename: 'CaseEdge',
              node: { __typename: 'LoanCase', id: 'previous-tenant-case' },
            },
          ],
        },
      },
    });

    expect(apolloClient.readQuery({ query: SESSION_QUERY })).not.toBeNull();

    await clearGraphqlSessionCache();

    expect(apolloClient.readQuery({ query: SESSION_QUERY })).toBeNull();
  });
});
