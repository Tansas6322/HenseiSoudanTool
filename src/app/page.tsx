"use client";

import Link from "next/link";
import { useUserKey } from "@/hooks/useUserKey";

export default function Home() {
  const { userKey, ready, clearUserKey } = useUserKey();

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">ユーザー情報を読み込み中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* タイトル */}
        <header className="border-b pb-4 mb-2">
          <h1 className="text-2xl font-bold mb-1">
            信長の野望 真戦 編成相談ツール
          </h1>
          <p className="text-sm text-gray-600">
            連盟メンバー向けの編成相談サポートツールです。
          </p>
        </header>

        {/* 現在のユーザー情報（ログイン／切り替えもここに集約） */}
        <section className="bg-white border rounded-lg p-3 text-sm flex items-center justify-between">
          <div>
            <div className="text-gray-600">現在のユーザー</div>
            <div className="mt-1">
              {userKey ? (
                <span className="font-semibold text-blue-700">{userKey}</span>
              ) : (
                <span className="text-gray-400">未ログイン</span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              依頼者としても編成者としても、ここでユーザー名を切り替えてから各画面に進んでください。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="px-3 py-1 rounded border text-xs bg-white hover:bg-blue-50"
            >
              {userKey ? "ユーザー切り替え" : "ログイン / ユーザー登録"}
            </Link>
            {userKey && (
              <button
                className="px-3 py-1 rounded border text-xs bg-white hover:bg-gray-50 text-gray-600"
                onClick={() => {
                  clearUserKey();
                  if (typeof window !== "undefined") {
                    window.location.href = "/login";
                  }
                }}
              >
                ログアウト
              </button>
            )}
          </div>
        </section>

        {/* 使い方（ざっくりフロー） */}
        <section className="bg-white border rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2">使い方（ざっくり）</h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-gray-700">
            <li>依頼者が自分のユーザー名でログインする。</li>
            <li>「所持武将登録」と「所持戦法登録」で所持状況を登録する。</li>
            <li>編成者も自分のユーザー名でログインする。</li>
            <li>
              編成者は「編成作成」で
              <span className="font-semibold">相談者（依頼者）</span>
              を選択し、その人の所持状況を見ながら編成を作る。
            </li>
          </ol>
        </section>

        {/* 依頼者向けメニュー */}
        <section className="bg-white border rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2">依頼者向けメニュー</h2>
          <p className="text-xs text-gray-600 mb-3">
            上部の「現在のユーザー」から自分のユーザー名を選択したうえで、所持情報を登録してください。
          </p>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <Link
              href="/my/officers"
              className="border rounded-lg p-3 hover:bg-blue-50 flex flex-col"
            >
              <span className="font-semibold mb-1">所持武将登録</span>
              <span className="text-xs text-gray-600">
                所持している武将と枚数を登録します。
              </span>
            </Link>

            <Link
              href="/my/skills"
              className="border rounded-lg p-3 hover:bg-blue-50 flex flex-col"
            >
              <span className="font-semibold mb-1">所持戦法登録</span>
              <span className="text-xs text-gray-600">
                伝承に使える戦法を登録します（固有戦法は武将情報から自動で参照されます）。
              </span>
            </Link>
          </div>
        </section>

        {/* 回答者（編成者）向けメニュー */}
        <section className="bg-white border rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2">回答者向けメニュー</h2>
          <p className="text-xs text-gray-600 mb-3">
            上部の「現在のユーザー」で
            <span className="font-semibold">自分（編成者）のユーザー名</span>
            を選択したうえで、「編成作成」から相談者の編成を作成します。
          </p>

          <div className="grid gap-3 md:grid-cols-1 text-sm">
            <Link
              href="/formation"
              className="border rounded-lg p-3 hover:bg-green-50 flex flex-col"
            >
              <span className="font-semibold mb-1">編成作成</span>
              <span className="text-xs text-gray-600">
                画面上部の「相談者」から依頼者のユーザー名を選び、
                その人の所持武将・戦法をもとに編成1〜編成5を作成します。
                編成ごとに依頼者コメント・回答者コメントも記録できます。
              </span>
            </Link>
          </div>
        </section>

        {/* フッター的な補足 */}
        <footer className="text-[11px] text-gray-400 pt-2 border-t">
          <p>
            ※ ユーザー名はゲーム内の名前など、連盟内で誰かわかるものを推奨します。
          </p>
          <p>※ データは Supabase 上に保存され、連盟メンバーで共有されます。</p>
          <p>
            ※ 編成には「相談者」と「編成者」の両方が記録されるため、誰がどの編成を作ったか後から確認できます。
          </p>
        </footer>
      </div>
    </main>
  );
}
