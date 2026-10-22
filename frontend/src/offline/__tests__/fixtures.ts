// fixtures.ts — golden vectors. Generated INDEPENDENTLY of the app code (Python `cryptography`,
// straight from the protocol text), with the RFC 8032 test-vector-1 server key that the backend tests use too
// (TestKeys.cs). If the app and these bytes ever disagree, the app is wrong.

export const VECTOR = {
  serverSeed: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  serverPublicKey: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  workerSeed: "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA",
  workerPublicKey: "ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ",
  tokenJson: "{\"workerId\":\"5b1d0c8a-2f4e-4a63-9d17-8e0c3a6f4b21\",\"fio\":\"Иванов Иван Иванович\",\"issuedAt\":1790000000,\"expiresAt\":1790043200,\"workerPublicKey\":\"ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ\"}",
  token: "eyJ3b3JrZXJJZCI6IjViMWQwYzhhLTJmNGUtNGE2My05ZDE3LThlMGMzYTZmNGIyMSIsImZpbyI6ItCY0LLQsNC90L7QsiDQmNCy0LDQvSDQmNCy0LDQvdC-0LLQuNGHIiwiaXNzdWVkQXQiOjE3OTAwMDAwMDAsImV4cGlyZXNBdCI6MTc5MDA0MzIwMCwid29ya2VyUHVibGljS2V5IjoiZWJWV0xvX21WUGxBZUxFUzZLbUxwNUFmaFRybWxiN1g0T09SQzYwRWxtUSJ9",
  serverSignature: "cM0w8u4FvBlGXpjyU3odn2btSynaWxNASf58jPnUc0jjI19jOBOmjaIlhqJPql14yeesLBRL24Z79mmZac8HCg",
  opJson: "{\"action\":\"TAKE\",\"toolCondition\":\"Good\",\"toolId\":\"17c4e5a2-93b8-4f10-8d6a-0b2e7c9d4f35\",\"toolName\":\"Дрель Bosch\",\"timestamp\":1790003600}",
  op: "eyJhY3Rpb24iOiJUQUtFIiwidG9vbENvbmRpdGlvbiI6Ikdvb2QiLCJ0b29sSWQiOiIxN2M0ZTVhMi05M2I4LTRmMTAtOGQ2YS0wYjJlN2M5ZDRmMzUiLCJ0b29sTmFtZSI6ItCU0YDQtdC70YwgQm9zY2giLCJ0aW1lc3RhbXAiOjE3OTAwMDM2MDB9",
  workerSignature: "XfL5gS16iTsIDlXy7Cmm7VdGTvd_dlmoTswXbc2H3AR_Obo9REgbf17VcbqcjAVQ9JCMcw5FUKF7qb6g9mQEAw",
  qr: "AT1.eyJ3b3JrZXJJZCI6IjViMWQwYzhhLTJmNGUtNGE2My05ZDE3LThlMGMzYTZmNGIyMSIsImZpbyI6ItCY0LLQsNC90L7QsiDQmNCy0LDQvSDQmNCy0LDQvdC-0LLQuNGHIiwiaXNzdWVkQXQiOjE3OTAwMDAwMDAsImV4cGlyZXNBdCI6MTc5MDA0MzIwMCwid29ya2VyUHVibGljS2V5IjoiZWJWV0xvX21WUGxBZUxFUzZLbUxwNUFmaFRybWxiN1g0T09SQzYwRWxtUSJ9.cM0w8u4FvBlGXpjyU3odn2btSynaWxNASf58jPnUc0jjI19jOBOmjaIlhqJPql14yeesLBRL24Z79mmZac8HCg.eyJhY3Rpb24iOiJUQUtFIiwidG9vbENvbmRpdGlvbiI6Ikdvb2QiLCJ0b29sSWQiOiIxN2M0ZTVhMi05M2I4LTRmMTAtOGQ2YS0wYjJlN2M5ZDRmMzUiLCJ0b29sTmFtZSI6ItCU0YDQtdC70YwgQm9zY2giLCJ0aW1lc3RhbXAiOjE3OTAwMDM2MDB9.XfL5gS16iTsIDlXy7Cmm7VdGTvd_dlmoTswXbc2H3AR_Obo9REgbf17VcbqcjAVQ9JCMcw5FUKF7qb6g9mQEAw",
} as const;

/** From backend TestKeys.cs: signatures made by the reference implementation. */
export const BACKEND_VECTORS = {
  serverSeed: 'nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A',
  serverPublicKey: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo',
  signatureOfEmptyMessage:
    '5VZDAMNgrHKQhuLMgG6CioSHfx645dl02HPgZSJJAVVfuIIVkKM7rMYeOXAc-bRr0lv18FlbviRlUUFDjnoQCw',
  /** signature of the ASCII string "AT1-TOKEN.abc" */
  signatureOfTokenAbc:
    '0t8e2xT57IZLHZo_NE6W6WEjCbhHR5TK6j3BDck8wbqqGrLZqvYItaKAfb2IiCG3D-veZidrqIYo37EFTmwvAg',
} as const;
