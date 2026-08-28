import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantSelectionScreen } from './TenantSelectionScreen';
import { setOidcTenantId } from '../oidc';

vi.mock('../oidc', () => ({ setOidcTenantId: vi.fn() }));

const setTenantMock = vi.mocked(setOidcTenantId);

describe('TenantSelectionScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('automatically selects the only backend-authorized membership', async () => {
    const onSelected = vi.fn();
    render(
      <TenantSelectionScreen
        memberships={[
          { tenantId: 'tenant-1', tenantName: 'Atlas', role: 'REVIEWER' },
        ]}
        onSelected={onSelected}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
    expect(setTenantMock).toHaveBeenCalledWith('tenant-1');
  });

  it('requires an explicit choice for multiple memberships', async () => {
    const onSelected = vi.fn();
    const user = userEvent.setup();
    render(
      <TenantSelectionScreen
        memberships={[
          { tenantId: 'tenant-1', tenantName: 'Atlas', role: 'REVIEWER' },
          { tenantId: 'tenant-2', tenantName: 'Beacon', role: 'PARTNER' },
        ]}
        onSelected={onSelected}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Beacon/ }));

    expect(setTenantMock).toHaveBeenCalledWith('tenant-2');
    expect(onSelected).toHaveBeenCalledOnce();
  });

  it('shows a safe sign-out path when no membership is provisioned', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <TenantSelectionScreen
        memberships={[]}
        onSelected={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByText(/no tenant membership has been provisioned/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
