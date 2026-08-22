import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getStoredToken } from './auth';
import {
  hasOidcSession,
  getOidcTenantId,
  getValidOidcAccessToken,
} from './oidc';

const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:3000/graphql';

const httpLink = new HttpLink({ uri: GRAPHQL_URL });

// Checked, and refreshed if needed, before every request — not on a
// background timer — so a request that happens to fire right at the
// skew boundary still gets a token that's valid for the request it's
// actually attached to.
const authLink = setContext(async (_, { headers }) => {
  if (hasOidcSession()) {
    const token = await getValidOidcAccessToken();
    const tenantId = getOidcTenantId();
    if (token && tenantId) {
      return {
        headers: {
          ...headers,
          authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      };
    }
  }

  const token = getStoredToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      LoanCase: { keyFields: ['id'] },
    },
  }),
});
