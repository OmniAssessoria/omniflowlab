# Plan - Colaborador Deletion Logic

Implement logical deletion for collaborators in OMNI Flow Lab, ensuring all linked operational data is filtered out when a collaborator is deleted. Only administrators can perform this action.

## User Review Required

> [!IMPORTANT]
> - Deleting a collaborator will effectively hide their associated clients, orders, and tickets from all operational views (Pipeline, Lists, Dashboards).
> - The collaborator's access will be blocked.
> - This is a **logical deletion** (soft delete); data remains in the database for audit purposes but is hidden from the app.

- Does the "cascade" behavior cover all your requirements, or should any data (like old history) remain visible?

## Proposed Changes

### Database & Backend

#### [MIGRATION] Add Deletion Columns and RPC
- Add `deleted_at`, `deleted_by`, `deleted_by_role`, `deletion_reason`, and `is_deleted` to `profiles` and `colaboradores` tables.
- Create a Supabase RPC `delete_colaborador_transacional` to:
    1. Mark the `profile` as inactive and deleted.
    2. Mark the `colaborador` record as deleted.
    3. Cascading: Mark all `clientes` linked to the collaborator as deleted.
    4. Cascading: Mark all `vendas` linked to the collaborator as deleted.
    5. Log the action in `audit_logs`.

#### [SERVER FUNCTIONS] `src/lib/users.functions.ts`
- Implement `deleteColaborador` server function:
    - Enforce `admin` role requirement.
    - Call the transacional RPC.
    - Return success status.

### Frontend & UI

#### [COMPONENTS] `src/routes/_shell.equipe.tsx` & `src/components/usuarios-panel.tsx`
- Add "Excluir colaborador" action to the collaborator card/row (visible only to `admin`).
- Implement confirmation modal:
    - Warning message.
    - Required text area for "Motivo da exclusão".
    - "Cancelar" and "Confirmar" buttons.

#### [DATA FILTERING] Global Operational Views
- Update queries in `src/lib/omni-store.tsx` (Pipeline, Dashboards) to filter out records where `is_deleted` is true or `deleted_at` is not null.
- Update `src/routes/_shell.equipe.tsx` to filter the collaborator list.
- Update `src/components/clientes-pedidos.tsx` to ensure clients/orders of deleted collaborators are hidden.

#### [AUTH GATE] `src/lib/auth.ts` / `src/routes/__root.tsx`
- Add a check during session hydration: if the user's profile is marked as `is_deleted`, sign them out and show the message: "Seu acesso foi desativado. Entre em contato com o administrador."

## Technical Details

- **Database Transaction**: The deletion will be atomic using a PostgreSQL function (RPC) to ensure data consistency.
- **Cascading Logic**: We will reuse the `is_deleted` and `deleted_at` patterns established for Clients and Orders.
- **Permissions**: Backend enforcement using `requireSupabaseAuth` and role checking within the server function.
- **Cache Invalidation**: Use `queryClient.invalidateQueries` to refresh all relevant data across the app after a successful deletion.
