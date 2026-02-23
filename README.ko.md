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
- 필드 선택 - `select()`로 필요한 필드만 로드 (메모리 및 비용 절약)
- 단일 문서 작업 - `findOne()`, `createOne()`, `updateOne()`, `deleteOne()`으로 효율적인 단일 문서 처리
- 존재 여부 확인 - `exists()`로 매칭 문서 존재 여부 빠르게 확인
- 전체 문서 조회 - `getAll()`로 매칭되는 모든 문서 데이터 조회
- 집계 쿼리 - `aggregate()`로 서버 사이드 `sum`, `average`, `count` 연산
- 커서 페이지네이션 - `paginate()`로 메모리 효율적인 페이지 단위 조회
- ID 직접 조회 - `getOne()`으로 문서 ID로 빠른 조회
- 벌크 작업 - `bulkCreate()`, `bulkUpdate()`, `bulkDelete()`로 여러 문서에 각기 다른 데이터로 효율적 처리
- 문서 변환 - `transform()`으로 각 문서에 커스텀 로직 적용 (가격 인상, 데이터 마이그레이션 등)
- 복사 & 이동 - `copyTo()`로 컬렉션 간 문서 복사/이동 (데이터 변환 옵션 포함)
- FieldValue 지원 - `increment()`, `arrayUnion()`, `delete()`, `serverTimestamp()` 등 사용 가능
- 서브컬렉션 & 컬렉션 그룹 - 서브컬렉션 쿼리 또는 동일 이름의 모든 컬렉션 쿼리
- Dry Run 모드 - 실제 변경 없이 작업 시뮬레이션
- 문서 개수 조회 - 문서를 로드하지 않고 빠르게 개수 확인
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
| `collection(path)` | 작업할 컬렉션 선택 (서브컬렉션 경로 지원) | `this` |
| `collectionGroup(id)` | 동일 ID의 모든 컬렉션 쿼리 | `this` |
| `where(field, op, value)` | 필터 조건 추가 (체이닝 가능) | `this` |
| `orderBy(field, direction?)` | 정렬 추가 (체이닝 가능) | `this` |
| `limit(count)` | 문서 수 제한 (체이닝 가능) | `this` |
| `select(...fields)` | 특정 필드만 조회 (체이닝 가능) | `this` |
| `count()` | 매칭되는 문서 개수 조회 | `CountResult` |
| `exists()` | 매칭되는 문서 존재 여부 확인 | `boolean` |
| `findOne()` | 첫 번째 매칭 문서 조회 | `{ id, data } \| null` |
| `getOne(id)` | ID로 문서 직접 조회 | `{ id, data } \| null` |
| `getAll()` | 모든 매칭 문서 조회 | `{ id, data }[]` |
| `preview(data)` | 업데이트 전 미리보기 | `PreviewResult` |
| `update(data, options?)` | 매칭되는 문서 업데이트 | `UpdateResult` |
| `updateOne(data)` | 첫 번째 매칭 문서 업데이트 | `{ success, id }` |
| `create(docs, options?)` | 새 문서 생성 | `CreateResult` |
| `createOne(data, id?)` | 단일 문서 생성 | `{ success, id }` |
| `upsert(data, options?)` | 업데이트 또는 생성 (set with merge) | `UpsertResult` |
| `delete(options?)` | 매칭되는 문서 삭제 | `DeleteResult` |
| `deleteOne()` | 첫 번째 매칭 문서 삭제 | `{ success, id }` |
| `aggregate(spec)` | sum/average/count 집계 쿼리 | `AggregateResult` |
| `paginate(options)` | 커서 기반 페이지네이션 | `PaginateResult` |
| `bulkCreate(docs, options?)` | 여러 문서를 각기 다른 데이터로 생성 | `BulkCreateResult` |
| `bulkUpdate(updates, options?)` | 여러 문서에 각기 다른 데이터 업데이트 | `BulkUpdateResult` |
| `bulkDelete(ids, options?)` | ID 배열로 여러 문서 삭제 | `BulkDeleteResult` |
| `transform(fn, options?)` | 커스텀 함수로 문서 변환 | `TransformResult` |
| `copyTo(target, options?)` | 다른 컬렉션으로 문서 복사/이동 | `CopyToResult` |
| `getFields(field)` | 특정 필드 값 조회 | `FieldValueResult[]` |

### 옵션

모든 쓰기 작업은 선택적 `options` 매개변수를 지원합니다:

```typescript
{
  onProgress?: (progress: ProgressInfo) => void;
  log?: LogOptions;
  batchSize?: number;  // update/upsert/delete 전용
  dryRun?: boolean;    // update/upsert/delete 전용 - 실제 쓰기 없이 시뮬레이션
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

**dryRun 옵션:**
- `true` 설정 시: 실제 변경 없이 `DryRunResult` 반환 (`wouldAffect` 개수와 `sampleIds` 포함)

### 반환 타입

| 타입 | 필드 |
|------|------|
| `CountResult` | `count` |
| `DryRunResult` | `wouldAffect`, `sampleIds[]`, `operation` |
| `PreviewResult` | `affectedCount`, `samples[]`, `affectedFields[]` |
| `UpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `UpsertResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `DeleteResult` | `successCount`, `failureCount`, `totalCount`, `deletedIds[]`, `failedDocIds?`, `logFilePath?` |
| `AggregateResult` | `{ [alias]: number \| null }` |
| `PaginateResult` | `docs[]`, `nextCursor`, `hasMore` |
| `BulkCreateResult` | `successCount`, `failureCount`, `totalCount`, `createdIds[]`, `failedDocIds?`, `logFilePath?` |
| `BulkUpdateResult` | `successCount`, `failureCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `BulkDeleteResult` | `successCount`, `failureCount`, `totalCount`, `deletedIds[]`, `failedDocIds?`, `logFilePath?` |
| `TransformResult` | `successCount`, `failureCount`, `skippedCount`, `totalCount`, `failedDocIds?`, `logFilePath?` |
| `CopyToResult` | `successCount`, `failureCount`, `totalCount`, `copiedIds[]`, `failedDocIds?`, `logFilePath?` |
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

// 필드 삭제
await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update({ temporaryData: FieldValue.delete() });
```

### 문서 개수 조회

```typescript
// 문서를 로드하지 않고 빠르게 개수 조회
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .count();

console.log(`${result.count}명의 비활성 사용자 발견`);
```

### 특정 필드만 조회

```typescript
// name, email 필드만 로드 (메모리 및 읽기 비용 절약)
const result = await updater
  .collection("users")
  .select("name", "email")
  .where("status", "==", "active")
  .findOne();

console.log(result?.data); // { name, email }만 포함

// 모든 작업에서 사용 가능 - 문서에 선택된 필드만 포함됨
const emails = await updater
  .collection("users")
  .select("email")
  .where("verified", "==", true)
  .getFields("email");
```

### 단일 문서 조회

```typescript
// 첫 번째 매칭 문서 찾기
const user = await updater
  .collection("users")
  .where("email", "==", "user@example.com")
  .findOne();

if (user) {
  console.log("사용자 발견:", user.id);
  console.log("사용자 데이터:", user.data);
} else {
  console.log("사용자를 찾을 수 없음");
}

// select와 함께 사용하여 효율적인 조회
const profile = await updater
  .collection("users")
  .select("name", "avatar", "tier")
  .where("username", "==", "johndoe")
  .findOne();
```

### 문서 존재 여부 확인

```typescript
// 관리자 사용자가 있는지 확인
const hasAdmin = await updater
  .collection("users")
  .where("role", "==", "admin")
  .exists();

if (!hasAdmin) {
  console.log("관리자 없음 - 기본 관리자 생성");
}

// 비용이 많이 드는 작업 전에 확인
const hasOldLogs = await updater
  .collection("logs")
  .where("createdAt", "<", thirtyDaysAgo)
  .exists();

if (hasOldLogs) {
  // 정리 작업 진행
}
```

### 전체 문서 조회

```typescript
// 매칭되는 모든 문서와 데이터 조회
const activeUsers = await updater
  .collection("users")
  .select("name", "email", "tier")
  .where("status", "==", "active")
  .limit(100)
  .getAll();

console.log(`${activeUsers.length}명의 활성 사용자 발견`);
activeUsers.forEach(user => {
  console.log(`${user.id}: ${user.data.name}`);
});
```

### 단일 문서 업데이트

```typescript
// 첫 번째 매칭 문서만 업데이트
const result = await updater
  .collection("users")
  .where("email", "==", "user@example.com")
  .updateOne({ lastLogin: new Date(), loginCount: FieldValue.increment(1) });

if (result.success) {
  console.log(`사용자 업데이트 완료: ${result.id}`);
} else {
  console.log("사용자를 찾을 수 없음");
}
```

### 단일 문서 삭제

```typescript
// 첫 번째 매칭 문서만 삭제
const result = await updater
  .collection("sessions")
  .where("token", "==", expiredToken)
  .deleteOne();

if (result.success) {
  console.log(`세션 삭제 완료: ${result.id}`);
} else {
  console.log("세션을 찾을 수 없음");
}
```

### 단일 문서 생성

```typescript
// 자동 생성 ID로 문서 생성
const result = await updater
  .collection("users")
  .createOne({ name: "Alice", status: "active", score: 100 });

console.log(`문서 생성 완료: ${result.id}`);

// 커스텀 ID로 문서 생성
const result2 = await updater
  .collection("users")
  .createOne({ name: "Bob", status: "active" }, "custom-bob-id");
```

### 집계 쿼리

```typescript
// 매칭 문서에 대해 sum, average, count 집계
const stats = await updater
  .collection("orders")
  .where("status", "==", "completed")
  .aggregate({
    totalAmount: { op: "sum", field: "amount" },
    avgAmount: { op: "average", field: "amount" },
    orderCount: { op: "count" },
  });

console.log(`총액: ${stats.totalAmount}원`);
console.log(`평균: ${stats.avgAmount}원`);
console.log(`주문 수: ${stats.orderCount}건`);
```

### 커서 기반 페이지네이션

```typescript
// 페이지 단위로 효율적으로 문서 조회
let nextCursor = undefined;

do {
  const page = await updater
    .collection("users")
    .orderBy("createdAt", "desc")
    .paginate({ pageSize: 20, startAfter: nextCursor });

  page.docs.forEach((doc) => {
    console.log(`${doc.id}: ${doc.data.name}`);
  });

  nextCursor = page.nextCursor;
} while (nextCursor);

// select와 함께 사용하여 메모리 효율 극대화
const page = await updater
  .collection("users")
  .select("name", "email")
  .orderBy("name")
  .paginate({ pageSize: 50 });
```

### ID로 문서 조회

```typescript
// 문서 ID로 직접 조회 (쿼리 필터 없이 가장 빠름)
const user = await updater.collection("users").getOne("user-123");

if (user) {
  console.log(`찾음: ${user.data.name} (${user.data.email})`);
} else {
  console.log("사용자를 찾을 수 없음");
}

// select와 함께 사용하여 특정 필드만 가져오기
const userBasic = await updater
  .collection("users")
  .select("name", "email")
  .getOne("user-123");

// 서브컬렉션에서 문서 조회
const order = await updater
  .collection("users/user-123/orders")
  .getOne("order-456");
```

### 벌크 업데이트

```typescript
// 여러 문서를 각각 다른 데이터로 업데이트
const result = await updater.collection("users").bulkUpdate([
  { id: "user-1", data: { name: "Alice", age: 30 } },
  { id: "user-2", data: { name: "Bob", status: "active" } },
  { id: "user-3", data: { email: "charlie@example.com" } },
]);

console.log(`성공: ${result.successCount}, 실패: ${result.failureCount}`);

// 진행 상황 콜백과 함께 사용
const result = await updater.collection("products").bulkUpdate(
  [
    { id: "prod-1", data: { price: 29.99, stock: 100 } },
    { id: "prod-2", data: { price: 49.99, stock: 50 } },
    // ... 더 많은 업데이트
  ],
  {
    onProgress: (progress) => {
      console.log(`${progress.processedCount}/${progress.totalCount} 처리됨`);
    },
  }
);

// 실패 처리
if (result.failureCount > 0) {
  console.log("실패한 문서 ID:", result.failedDocIds);
}
```

### 벌크 생성

```typescript
// 여러 문서를 각기 다른 데이터로 생성
const result = await updater.collection("users").bulkCreate([
  { id: "user-1", data: { name: "Alice", role: "admin" } },
  { id: "user-2", data: { name: "Bob", role: "user" } },
  { data: { name: "Charlie", role: "user" } }, // 자동 생성 ID
]);

console.log(`${result.successCount}개 문서 생성 완료`);
console.log("생성된 ID:", result.createdIds);
```

### 벌크 삭제

```typescript
// ID 배열로 여러 문서 삭제
const result = await updater
  .collection("users")
  .bulkDelete(["user-1", "user-2", "user-3"]);

console.log(`${result.successCount}개 문서 삭제 완료`);
console.log("삭제된 ID:", result.deletedIds);

// 진행 상황 추적과 함께 사용
const result2 = await updater.collection("logs").bulkDelete(expiredLogIds, {
  onProgress: (progress) => {
    console.log(`${progress.percentage}% 완료`);
  },
});
```

### 문서 변환

```typescript
// 각 문서에 커스텀 로직 적용
const result = await updater
  .collection("products")
  .where("category", "==", "electronics")
  .transform((doc) => ({
    price: doc.data.price * 1.1, // 10% 가격 인상
    name: doc.data.name.toUpperCase(),
  }));

console.log(`변환: ${result.successCount}, 건너뜀: ${result.skippedCount}`);

// 조건부 건너뛰기 (null 반환 시 스킵)
const result2 = await updater
  .collection("users")
  .transform((doc) => {
    if (doc.data.score < 50) return null; // 낮은 점수 건너뛰기
    return { tier: "premium" };
  });
```

### 문서 복사 & 이동

```typescript
// 다른 컬렉션으로 문서 복사
const result = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .copyTo("archived_users");

console.log(`${result.successCount}개 문서 복사 완료`);

// 데이터 변환하며 복사 (민감 정보 제거 등)
await updater
  .collection("users")
  .copyTo("public_profiles", {
    transform: (doc) => ({
      name: doc.data.name,
      avatar: doc.data.avatar,
      // password, email 제외
    }),
  });

// 문서 이동 (복사 + 원본 삭제)
await updater
  .collection("orders")
  .where("status", "==", "completed")
  .copyTo("order_archive", { deleteSource: true });
```

### Dry Run 모드

```typescript
// 실제 변경 없이 작업 시뮬레이션
const simulation = await updater
  .collection("users")
  .where("status", "==", "inactive")
  .update(
    { status: "archived" },
    { dryRun: true }
  );

console.log(`${simulation.wouldAffect}개 문서가 영향을 받을 예정`);
console.log("샘플 ID:", simulation.sampleIds);

// 삭제에도 사용 가능
const deleteSimulation = await updater
  .collection("logs")
  .where("createdAt", "<", thirtyDaysAgo)
  .delete({ dryRun: true });

console.log(`${deleteSimulation.wouldAffect}개 문서가 삭제될 예정`);
```

### 서브컬렉션

```typescript
// 특정 서브컬렉션 경로 쿼리
const result = await updater
  .collection("users/user-123/orders")
  .where("status", "==", "pending")
  .update({ status: "cancelled" });

// 동적 경로 사용
const userId = "user-123";
await updater
  .collection(`users/${userId}/notifications`)
  .where("read", "==", false)
  .delete();
```

### 컬렉션 그룹 쿼리

```typescript
// 모든 사용자의 "orders" 서브컬렉션을 한 번에 쿼리
const result = await updater
  .collectionGroup("orders")
  .where("status", "==", "pending")
  .where("createdAt", "<", thirtyDaysAgo)
  .update({ status: "expired" });

console.log(`${result.successCount}개 주문 업데이트 완료`);

// 참고: collectionGroup은 쿼리 필드에 대한 Firestore 인덱스가 필요합니다
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
