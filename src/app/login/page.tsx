"use client";

import { FormEvent, useState } from "react";
import { useUserKey } from "@/hooks/useUserKey";

export default function LoginPage() {
  const { userKey, setUserKey, clearUserKey } = useUserKey();
  const [name, setName] = useState(userKey ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      alert("ユーザー名を入力してください");
      return;
    }
    setUserKey(trimmed);
    window.location.href = "/my/officers";
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-center">
          編成相談ツール ユーザー選択
        </h1>

        <p className="text-sm text-gray-600">
          連盟内で使うニックネームを入力してください（日本語OK）。
          同じ名前を使うと同じデータにアクセスできます。
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">ユーザー名</label>
            <input
              className="border rounded w-full px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: りゅうの / 〇〇同盟_太郎"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            このユーザーで開始
          </button>
        </form>

        {userKey && (
          <div className="text-xs text-gray-500">
            現在のユーザー: <strong>{userKey}</strong>{" "}
            <button
              className="ml-2 underline"
              onClick={() => {
                clearUserKey();
                setName("");
              }}
            >
              別のユーザーに切り替える
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
