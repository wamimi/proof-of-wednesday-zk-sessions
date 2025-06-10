// Account contract that uses Schnorr signatures for authentication using a hardcoded public key.
use dep::aztec::macros::aztec;

#[aztec]
pub contract SchnorrHardcodedAccount {
    use dep::authwit::{
        account::AccountActions,
        auth_witness::get_auth_witness,
        entrypoint::{app::AppPayload, fee::FeePayload},
    };
    use dep::aztec::prelude::PrivateContext;

    use dep::aztec::macros::functions::{private, view};
    use std::embedded_curve_ops::EmbeddedCurvePoint;

    // Hardcoded public key for Schnorr verification
    global public_key: EmbeddedCurvePoint = EmbeddedCurvePoint {
        x: 0x16b93f4afa5e5338cb8a65529f5723b71f92b3a99cb9c0f9942352885a49852f,
        y: 0x011d68a0f5a720973e6cefe68e3d2e81134b22c34795b5c1f6a1e367683451e,
    };

    #[private]
    fn entrypoint(payload: AppPayload, fee_payload: FeePayload) -> pub AccountActions {
        let is_valid = is_valid_impl(payload);
        assert(is_valid);
        payload.actions.execute(&mut context)
    }

    #[view]
    fn is_valid(payload: AppPayload) -> bool {
        is_valid_impl(payload)
    }

    fn is_valid_impl(payload: AppPayload) -> bool {
        let signature: [Field; 64] = get_auth_witness(&mut context, payload.hash());
        let verification = std::schnorr::verify_signature(public_key, signature, payload.hash());
        verification
    }
} 