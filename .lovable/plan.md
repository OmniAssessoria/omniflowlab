# Plan - Commissions Module Hardening and Role-Based Access

Enhance the commissions module configuration to support granular role-based visibility, as requested in `instrucoes.md`.

## User-facing Changes

### Admin Dashboard / Settings
- **Commissions Module Card**: In `Settings > System`, the existing toggle will now open a modal to select specific profiles (Admin, Manager, Consultant) instead of a simple ON/OFF switch.
- **Selectable Profiles**: Admin can choose one or more profiles. BKO is excluded from this configuration.
- **Mandatory Selection**: Preventing activation without at least one profile selected.

### Navigation and Access
- **Menu Visibility**: The "Comissões" menu item will only be visible to profiles explicitly enabled in the settings.
- **Route Protection**: Direct access to `/comissoes` will be blocked with a clear message if the module is disabled for the user's profile.
- **Dashboard Integration**: Commission cards and metrics will be hidden in dashboards if the module is disabled for the profile.
- **Data Fetching**: The system will avoid unnecessary commission data fetches when the module is disabled.

### User Experience
- **Modal UI**: Added a standard modal with "Select all", "Cancel", and "Activate" options.
- **Consistency**: The Admin always retains access to the configuration panel even if the module is globally inactive.

## Technical Details

### Database / Backend
- **App Settings**: Update the `commissions_enabled` key in `app_settings` to store a JSON structure: `{ enabled: boolean, roles: string[] }`.
- **Server Functions**: Update `setComissoesEnabled` to handle the new payload and `getComissoesEnabled` to return the new structure.
- **Middleware/Utilities**: Update `ensureComissoesModule` and `isModuleEnabled` in `src/lib/module-flags.ts` to respect the role-based logic.

### Frontend
- **Features Provider**: Update `src/lib/features.tsx` to calculate `comissoesVisible` based on the user's `primaryRole` and the roles listed in the configuration.
- **App Shell**: Hardened the redirection logic and sidebar visibility.
- **Config Page**: Refactor `SistemaPanel` in `src/routes/_shell.config.tsx` to implement the profile selection modal.
- **Commissions Page**: Update `src/routes/_shell.comissoes.tsx` to use the new visibility flag for blocking access and showing appropriate feedback.

### Audit
- **Audit Logs**: Ensure module state changes are logged with details about which profiles were enabled/disabled.
