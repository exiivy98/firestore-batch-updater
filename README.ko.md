# Firestore Batch Updater

[![npm version](https://img.shields.io/npm/v/firestore-batch-updater.svg)](https://www.npmjs.com/package/firestore-batch-updater)

쿼리 기반 필터링과 진행 상황 추적 기능을 제공하는 Firebase Firestore 대량 업데이트 라이브러리입니다.

[English](./README.md) | 한국어

## 주요 기능

- 쿼리 기반 업데이트 - `where()` 조건으로 문서 필터링
- 500개 제한 없음 - Firebase Admin SDK의 BulkWriter 활용
- 변경 사항 미리보기 - 업데이트 전 Before/After 비교
- 진행 상황 추적 - 실시간 진행률 콜백
- 일괄 생성/Upsert/삭제 - 여러 문서를 한 번에 생성, upsert 또는 삭제
- 정렬 및 제한 - `orderBy()`와 `limit()`으로 정밀한 제어
- FieldValue 지원 - `increment()`, `arrayUnion()`, `serverTimestamp()` 등 사용 가능
- 로그 파일 생성 - 감사를 위한 상세 작업 로그 (선택사항)

## 설치

```bash
# npm
npm install firestore-batch-updater

# yarn
yarn add firestore-batch-updater

# pnpm
pnpm add firestore-batch-updater
```

**필수 peer dependency:**

```bash
# npm
npm install firebase-admin

# yarn
yarn add firebase-admin

# pnpm
pnpm add firebase-admin
```

## 빠른 시작

```typescript
import { BatchUpdater } from "firestore-batch-updater";
import { getFirestore } from "firebase-admin/firestore";

const firestore = getFirestore();
const updater = new BatchUpdater(firestore);

// 변경 사항 미리보기
const preview = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .preview({ status: "archived" });

console.log(`${preview.affectedCount}개 문서가 영향을 받습니다`);

// 업데이트 실행
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ status: "archived" });

console.log(`${result.successCount}개 문서 업데이트 완료`);
```

## API 레퍼런스

### 메서드 개요

| 메서드 | 설명 | 반환값 |
|--------|------|--------|
| `collection(path)` | 작업할 컬렉션 선택 | `this` |
| `where(field, op, value)` | 필터 조건 추가 (체이닝 가능) | `this` |
| `orderBy(field, direction?)` | 정렬 추가 (체이닝 가능) | `this` |
| `limit(count)` | 문서 수 제한 (체이닝 가능) | `this` |
| `preview(data)` | 업데이트 전 미리보기 | `PreviewResult` |
| `update(data, options?)` | 매칭되는 문서 업데이트 | `UpdateResult` |
| `create(docs, options?)` | 새 문서 생성 | `CreateResult` |
| `upsert(data, options?)` | 업데이트 또는 생성 (set with merge) | `UpsertResult` |
| `delete(options?)` | 매칭되는 문서 삭제 | `DeleteResult` |
| `getFields(field)` | 특정 필드 값 조회 | `FieldValueResult[]` |

### 옵션

모든 쓰기 작업은 선택적 `options` 매개변수를 지원합니다:

```typescript
{
  onProgress?: (progress: ProgressInfo) => void;
  log?: LogOptions;
  batchSize?: number;  // update/upsert/delete 전용
}

// ProgressInfo
{
  current: number;     // 처리된 문서 수
  total: number;       // 전체 문서 수
  percentage: number;  // 0-100
}

// LogOptions
{
  enabled: boolean;    // 로그 파일 생성 여부
  path?: string;       // 로그 디렉토리 경로 (기본값: ./logs)
  filename?: string;   // 파일명 (기본값: 자동 생성)
}
```

**batchSize 옵션 (대용량 컬렉션용):**
- 미설정: 모든 문서를 메모리에 한 번에 로드 (소규모 컬렉션에 적합)
- 설정 시 (예: `batchSize: 1000`): 커서 페이지네이션을 사용하여 배치 단위로 처리 (대규모 컬렉션의 메모리 문제 방지)

### 반환 타입

| 타입 | 필드 |
|------|------|
| `PreviewResult` | `affectedCount`, `samples[]`, `affectedFields[]` |
| `UpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `UpsertResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `DeleteResult` | `successCount`, `failureCount`, `totalCount`, `deletedIds[]`, `failedDocIds?`, `logFilePath?` |
| `FieldValueResult` | `id`, `value` |

## 사용 예시

### 문서 업데이트

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ status: "archived" });
```

### 문서 생성

```typescript
// 자동 생성 ID
const result = await updater.collection("users").create([
  { data: { name: "Alice", age: 30 } },
  { data: { name: "Bob", age: 25 } },
]);
console.log("생성된 ID:", result.createdIds);

// 지정 ID
const result2 = await updater.collection("users").create([
  { id: "user-001", data: { name: "Charlie" } },
  { id: "user-002", data: { name: "Diana" } },
]);
```

### 문서 Upsert

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "active")
  .upsert({ tier: "premium", updatedAt: new Date() });
```

### 문서 삭제

```typescript
// 조건에 맞는 문서 삭제
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .where("lastLoginAt", "<", ninetyDaysAgo)
  .delete();

console.log(`${result.successCount}개 문서 삭제됨`);
console.log("삭제된 ID:", result.deletedIds);
```

### 업데이트 전 미리보기

```typescript
const preview = await updater
  .collection("orders")
  .where("status", "==", "pending")
  .preview({ status: "cancelled" });

if (preview.affectedCount > 1000) {
  console.log("문서가 너무 많습니다. 중단합니다.");
} else {
  await updater
    .collection("orders")
    .where("status", "==", "pending")
    .update({ status: "cancelled" });
}
```

### 진행 상황 추적

```typescript
const result = await updater
  .collection("products")
  .where("inStock", "==", false)
  .update(
    { status: "discontinued" },
    {
      onProgress: (progress) => {
        console.log(`${progress.percentage}% 완료`);
      },
    }
  );
```

### 필드 값 조회

```typescript
const emails = await updater
  .collection("users")
  .where("status", "==", "active")
  .getFields("email");

// [{ id: 'user1', value: 'user1@example.com' }, ...]
```

### 다중 조건

```typescript
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .where("lastLoginAt", "<", ninetyDaysAgo)
  .where("accountType", "==", "free")
  .update({ status: "archived" });
```

### 정렬 및 제한

```typescript
// 상위 10명 점수 높은 사용자만 업데이트
const result = await updater
  .collection("users")
  .where("status", "==", "active")
  .orderBy("score", "desc")
  .limit(10)
  .update({ tier: "premium" });

// 가장 오래된 비활성 사용자 100명 삭제
const deleteResult = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .orderBy("lastLoginAt", "asc")
  .limit(100)
  .delete();
```

### FieldValue 사용

```typescript
import { BatchUpdater, FieldValue } from "firestore-batch-updater";

// 숫자 증가
await updater
  .collection("products")
  .where("id", "==", "product-1")
  .update({ viewCount: FieldValue.increment(1) });

// 배열에 항목 추가
await updater
  .collection("users")
  .where("status", "==", "active")
  .update({ tags: FieldValue.arrayUnion("premium", "verified") });

// 배열에서 항목 제거
await updater
  .collection("users")
  .where("id", "==", "user-1")
  .update({ tags: FieldValue.arrayRemove("inactive") });

// 서버 타임스탬프
await updater
  .collection("users")
  .where("status", "==", "active")
  .update({ updatedAt: FieldValue.serverTimestamp() });
```

> **참고:** 서로 다른 필드에 여러 `where()` 조건을 사용하거나, `where()`와 `orderBy()`를 다른 필드에 사용할 경우, Firestore에서 [복합 인덱스](https://firebase.google.com/docs/firestore/query-data/indexing)가 필요할 수 있습니다. `FAILED_PRECONDITION` 오류가 발생하면 오류 메시지의 링크를 통해 필요한 인덱스를 생성하세요.

### 에러 처리

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "test")
  .update({ status: "verified" });

if (result.failureCount > 0) {
  console.log(`${result.failureCount}개 문서 실패`);
  console.log("실패한 ID:", result.failedDocIds);
}
```

### 대용량 컬렉션 페이지네이션

```typescript
// 메모리 문제 방지를 위해 1000개씩 배치 처리
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    {
      batchSize: 1000,
      onProgress: (progress) => {
        console.log(`${progress.percentage}% 완료`);
      },
    }
  );
```

### 로그 파일 생성

```typescript
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    {
      log: {
        enabled: true,
        path: "./logs",  // 선택사항
      },
    }
  );

if (result.logFilePath) {
  console.log(`로그 저장 경로: ${result.logFilePath}`);
}
```

로그 파일 예시:
```
============================================================
FIRESTORE BATCH OPERATION LOG
============================================================

Operation: UPDATE
Collection: users
Started: 2024-01-15T10:30:00.000Z
Completed: 2024-01-15T10:30:05.000Z

Conditions:
  - status == "inactive"

============================================================
SUMMARY
============================================================
Total: 150
Success: 148
Failure: 2

============================================================
DETAILS
============================================================

2024-01-15T10:30:01.000Z [SUCCESS] user-001
2024-01-15T10:30:01.100Z [SUCCESS] user-002
2024-01-15T10:30:01.200Z [FAILURE] user-003
  Error: Document not found
...
```

## 요구 사항

- Node.js 18+
- Firebase Admin SDK 13.x
- 서버 사이드 환경 전용 (Admin SDK 필요)

## BulkWriter를 사용하는 이유?

이 라이브러리는 Firebase의 `BulkWriter`를 사용합니다:

- 500개 문서 제한 없음 (배치 쓰기와 달리)
- 자동 속도 제한
- 내장 재시도 로직
- 대규모 작업에 더 나은 성능

## 예제

더 자세한 예제는 [examples](./examples) 폴더를 확인하세요:

- [basic.ts](./examples/basic.ts) - 기본 사용 워크플로우
- [api-route.ts](./examples/api-route.ts) - API 엔드포인트에서 사용하기
- [advanced.ts](./examples/advanced.ts) - 고급 기능 및 패턴

## 면책 조항

이 패키지는 별도의 보증 없이 제공되며, 사용으로 인해 발생하는 데이터 손실, 손상 또는 기타 문제에 대해 작성자는 책임지지 않습니다. 프로덕션 환경에서 사용하기 전에 반드시 개발 환경에서 충분히 테스트하고, 데이터 백업을 확보하시기 바랍니다.

## 라이선스

MIT
