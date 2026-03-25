# Legacy Supabase users and access transition

Legacy Supabase users already created for testing must be included in the transition to the new ownership and access model. The implementation must not assume a clean database or new-signup-only flow. Existing users must be mapped into the correct role and portal access state through safe backfill/compatibility logic without requiring account recreation.
