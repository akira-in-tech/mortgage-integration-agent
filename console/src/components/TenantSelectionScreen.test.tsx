import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantSelectionScreen } from './TenantSelectionScreen';
import { fetchOidcTenantMemberships, setOidcTenantId } from '../oidc';

vi.mock('../oidc', () => ({
  fetchOidcTenantMemberships: vi.fn(),
  setOidcTenantId: vi.fn(),
}));

const fetchMembershipsMock = vi.mocked(fetchOidcTenantMemberships);
const setTenantMock = vi.mocked(setOidcTenantId);

describe('TenantSelectionScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('automatically selects the only backend-authorized membership', async () => {
    fetchMembershipsMock.mockResolvedValue([
      { tenantId: 'tenant-1', tenantName: 'Atlas', role: 'REVIEWER' },
    ]);
    const onSelected = vi.fn();

    render(
      <TenantSelectionScreen onSelected={onSelected} onCancel={vi.fn()} />,
    );

    await waitFor(() => expect(onSelected).toHaveBeenCalledOnce());
    expect(setTenantMock).toHaveBeenCalledWith('tenant-1');
  });

  it('requires an explicit choice when the identity belongs to multiple tenants', async () => {
    fetchMembershipsMock.mockResolvedValue([
      { tenantId: 'tenant-1', tenantName: 'Atlas', role: 'REVIEWER' },
      { tenantId: 'tenant-2', tenantName: 'Beacon', role: 'PARTNER' },
    ]);
    const onSelected = vi.fn();
    const user = userEvent.setup();

    render(
      <TenantSelectionScreen onSelected={onSelected} onCancel={vi.fn()} />,
    );
    await user.click(await screen.findByRole('button', { name: /Beacon/ }));

    expect(setTenantMock).toHaveBeenCalledWith('tenant-2');
    expect(onSelected).toHaveBeenCalledOnce();
  });

  it('shows a safe sign-out path when no membership is provisioned', async () => {
    fetchMembershipsMock.mockResolvedValue([]);
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<TenantSelectionScreen onSelected={vi.fn()} onCancel={onCancel} />);

    expect(
      await screen.findByText(/no tenant membership has been provisioned/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
