# Design Spec: Removal of Year Dependency from API Search and Cache

## Overview

This design specifies the complete removal of the 'year' parameter as a requirement for searching and caching movie titles within the FlixMonkey application.

## Problem Statement

The 'year' is inconsistently available in Netflix's DOM, making it an unreliable and fragile constraint for API searches. Relying on it causes search failures and complicates the caching and lookup logic without providing significant precision improvements.

## Proposed Changes

### 1. API Search Decoupling

- **`ApiClientManager.getData`**: Remove `domYear` parameter from the signature and propagation logic.
- **API Client Interfaces**: Remove `domYear` from the `search(displayTitle, domYear)` methods in all client implementations.
- **Search Logic**: API clients will now perform searches based solely on the `displayTitle`.

### 2. Cache Key Simplification

- **Cache Logic**: Update `src/core/cache.js` to derive cache keys using only `displayTitle` (or `displayTitle` + `source` for isolation). The `year` component will be dropped from key generation.
- **Impact**: Existing cache entries will be invalidated, leading to a natural cache repopulation with the new, simpler key structure.

### 3. Title Domain Object

- The `Title` class will continue to store a `year` (populated by API responses), but it will no longer be treated as a search or cache dependency.

## Risks and Mitigation

- **Collisions**: Titles with identical names but different years may collide in the cache. This is accepted as an inherent limitation of the source Netflix data.

## Verification Strategy

- Update unit tests in `tests/unit/core/api-clients.test.js` to remove `year` from test cases.
- Validate that the cache continues to store and retrieve data correctly using only `displayTitle`.
- Ensure all API clients successfully return results with title-only queries.
