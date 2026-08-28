import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getStoredToken } from './auth';
import { getOidcCsrfToken, hasOidcSession, getOidcTenantId } from './oidc';

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? '/graphql';

const httpLink = new HttpLink({ uri: GRAPHQL_URL, credentials: 'include' });

// Checked, and refreshed if needed, before every request — not on a
// background timer — so a request that happens to fire right at the
// skew boundary still gets a token that's valid for the request it's
// actually attached to.
const authLink = setContext(async (_, { headers }) => {
  if (hasOidcSession()) {
    const tenantId = getOidcTenantId();
    const csrfToken = getOidcCsrfToken();
    if (tenantId && csrfToken) {
      return {
        headers: {
          ...headers,
          'x-tenant-id': tenantId,
          'x-csrf-token': csrfToken,
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
