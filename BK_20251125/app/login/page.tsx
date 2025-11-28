"use client";

import { FormEvent, useEffect, useState } from "react";
import { useUserKey } from "@/hooks/useUserKey";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const { userKey, setUserKey, clearUserKey } = useUserKey();
  const [name, setName] = useState(userKey ?? "");

  // 登録済みユーザー一覧
  const [existingUsers, setExistingUsers] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 検索用
  const [userSearch, setUserSearch] = useState("");

  // 入力フォームからログイン
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      alert("ユーザー名を入力してください");
      return;
    }
    setUserKey(trimmed);
    window.location.href = "/";
  };

  // ユーザー一覧から選択してログイン
  const handleSelectUser = (selected: string) => {
    setUserKey(selected);
    window.location.href = "/";
  };

  // Supabase から登録済みユーザー名を取得
  useEffect(() => {
    const fetchUsers = async () => {
      setUsersLoading(true);

      const nameSet = new Set<string>();

      try {
        // formations.user_key
        const { data: formations, error: fError } = await supabase
          .from("formations")
          .select("user_key");

        if (!fError && formations) {
          formations.forEach((row: any) => {
            if (row.user_key) nameSet.add(row.user_key as string);
          });
        }

        // user_officers.user_key
        const { data: officers, error: oError } = await supabase
          .from("user_officers")
          .select("user_key");

        if (!oError && officers) {
          officers.forEach((row: any) => {
            if (row.user_key) nameSet.add(row.user_key as string);
          });
        }

        // user_skills.user_id
        const { data: skills, error: sError } = await supabase
          .from("user_skills")
          .select("user_id");

        if (!sError && skills) {
          skills.forEach((row: any) => {
            if (row.user_id) nameSet.add(row.user_id as string);
          });
        }
      } catch (err) {
        console.error("ユーザー一覧取得エラー:", err);
      }

      const list = Array.from(nameSet).sort((a, b) =>
        a.localeCompare(b, "ja")
      );
      setExistingUsers(list);
      setUsersLoading(false);
    };

    fetchUsers();
  }, []);

  // 検索結果で絞り込み
  const filteredUsers =
    userSearch.trim() === ""
      ? existingUsers
      : existingUsers.filter((u) =>
          u.toLowerCase().includes(userSearch.toLowerCase())
        );

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border rounded-lg p-6 w-full max-w-md space-y-5">
        <h1 className="text-xl font-bold text-center">
          編成相談ツール ユーザー選択
        </h1>

        {/* 説明 */}
        <p className="text-sm text-gray-600">
          連盟内で使うニックネームを入力してください（日本語OK）。
          同じ名前を使うと同じデータにアクセスできます。
        </p>

        {/* 新規/手入力エリア */}
        <section className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">ユーザー名</label>
              <input
                className="border rounded w-full px-2 py-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: Tansas / 八咫烏太郎"
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
        </section>

        {/* 既存ユーザーから選択 */}
        <section className="border-t pt-4 space-y-3">
          <h2 className="text-sm font-semibold">登録済みユーザーから選ぶ</h2>

          {/* 🔍 検索ボックス */}
          <div>
            <input
              className="border rounded w-full px-2 py-1 text-sm"
              placeholder="ユーザー名で検索（部分一致）"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          {usersLoading ? (
            <div className="text-xs text-gray-500">
              ユーザー一覧を読み込み中...
            </div>
          ) : existingUsers.length === 0 ? (
            <div className="text-xs text-gray-400">
              まだ登録済みユーザーがいません。
              先に上のフォームから作成してください。
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-xs text-gray-400">
              該当するユーザーが見つかりません。
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm max-h-40 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  className="px-2 py-1 border rounded bg-white hover:bg-blue-50"
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ホームに戻る */}
        <div className="pt-2 text-center">
          <a href="/" className="text-blue-600 underline text-sm">
            ホームに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
