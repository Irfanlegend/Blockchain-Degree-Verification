# TrustChain Platform: Decentralized Credential Verification

TrustChain is a decentralized platform built on the Polygon Amoy Testnet for issuing, holding, and verifying educational credentials. It leverages blockchain technology to ensure the authenticity, integrity, and immutability of academic records, eliminating the need for traditional, often cumbersome, verification processes.

## Core Components and Roles

The TrustChain ecosystem consists of three main portals and a blockchain-based credential registry:

1.  **University Portal (Issuer):**
    *   **Role:** Universities act as credential **issuers**. They are responsible for registering themselves on the TrustChain blockchain and issuing digital credentials to students.
    *   **Functionality:**
        *   **Issuer Registration:** Universities register their identity and decentralized identifier (DID) on the blockchain, becoming authorized issuers.
        *   **Credential Issuance:** They create and issue credentials (e.g., degrees, certificates, transcripts) to students. Each credential is cryptographically hashed and recorded on the blockchain, ensuring its tamper-proof nature. The platform supports both single and batch credential issuance.
        *   **Credential Revocation:** In cases of error or policy changes, universities have the ability to revoke previously issued credentials on the blockchain.

2.  **Student Wallet (Holder):**
    *   **Role:** Students are the credential **holders**. They receive and manage their digital credentials securely in their personal wallets.
    *   **Functionality:**
        *   **Credential Reception:** Students receive issued credentials directly into their TrustChain-compatible digital wallets.
        *   **Credential Management:** They can view their credentials, store them securely, and present them for verification when needed.
        *   **QR Code Generation:** The student wallet generates unique QR codes for each credential, containing the necessary information (e.g., credential hash) for verifiers to authenticate.

3.  **Verifier Portal (Verifier):**
    *   **Role:** Verifiers are entities (e.g., employers, other educational institutions) that need to authenticate the credentials presented by students.
    *   **Functionality:**
        *   **Credential Verification:** Verifiers use the portal to instantly verify the authenticity and validity of credentials by scanning a student's QR code or manually entering a credential hash.
        *   **Blockchain Interaction:** The Verifier Portal interacts with the `CredentialRegistry` smart contract on the Polygon Amoy Testnet to check if a credential exists, is valid, and retrieves details about the issuer and holder.
        *   **Bulk Verification:** Supports uploading CSV files for verifying multiple credentials simultaneously.
        *   **Verification History & Certificates:** Maintains a history of verifications and allows verifiers to download formal verification certificates.

4.  **Blockchain (CredentialRegistry Smart Contract):**
    *   **Role:** The core immutable ledger of the TrustChain platform.
    *   **Functionality:**
        *   **Credential Storage:** Stores the cryptographic hashes of issued credentials, along with associated metadata (issuer address, holder address, credential type, issuance date, issuer name).
        *   **Issuer Management:** Manages the registration and authorization status of universities (issuers).
        *   **Verification Logic:** Provides functions to verify a credential's existence and validity on the blockchain.
        *   **Revocation Mechanism:** Allows authorized issuers to mark credentials as revoked.

## How it Works

1.  A **University** registers as an **Issuer** on the TrustChain platform via the **University Portal**.
2.  The University issues a credential to a **Student**. This action records a unique hash of the credential data on the blockchain through the `CredentialRegistry` smart contract.
3.  The **Student** receives the credential in their **Student Wallet** and can generate a QR code for it.
4.  A **Verifier** uses the **Verifier Portal** to scan the Student's QR code (or manually enters the hash).
5.  The **Verifier Portal** queries the `CredentialRegistry` smart contract on the blockchain to verify the credential's hash, status, issuer, and holder.
6.  The **Verifier** receives an instant, tamper-proof verification result, confirming the credential's authenticity and integrity.
