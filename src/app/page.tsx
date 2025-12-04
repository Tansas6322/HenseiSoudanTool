"use client";

import Link from "next/link";
import { useUserKey } from "@/hooks/useUserKey";

export default function Home() {
  const { userKey, ready, clearUserKey } = useUserKey();

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-gray-600 dark:text-gray-300">
          ユーザー情報を読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* タイトル */}
        <header className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-2">
          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
            信長の野望 真戦 編成相談ツール
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            一門メンバー向けの編成相談サポートツールです。
          </p>
        </header>

        {/* 現在のユーザー情報（ログイン／切り替えもここに集約） */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm flex items-center justify-between">
          <div>
            <div className="text-gray-600 dark:text-gray-300">現在のユーザー</div>
            <div className="mt-1">
              {userKey ? (
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {userKey}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">未ログイン</span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ログイン・ユーザー登録してから各画面に進んでください。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/login"
              className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors"
            >
              {userKey ? "ユーザー切り替え" : "ログイン / ユーザー登録"}
            </Link>
            {userKey && (
              <button
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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

        {/* 使い方（依頼者向けざっくりフロー） */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
            使い方（依頼者）
          </h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-gray-700 dark:text-gray-200">
            <li>自分のユーザー名でログインする。</li>
            <li>「所持武将登録」と「所持戦法登録」で所持状況を登録する。</li>
            <li>必要に応じて「編成作成」にコメントを記載して登録する。</li>
            <li>Discordの編成相談チャネルに登録したことを記載し、相談する</li>
            <li>「自分宛の編成を見る」から編成を確認する</li>
          </ol>
        </section>
        
        {/* 使い方（編成者ざっくりフロー） */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
            使い方（編成者）
          </h2>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-gray-700 dark:text-gray-200">
            <li>自分のユーザー名でログインする。</li>
            <li>
              「編成作成」で依頼者を選択し、その人の所持状況を見ながら編成を作る。
            </li>
            <li>依頼者に編成を作成したことを伝え、確認してもらう</li>
          </ol>
        </section>

        {/* 依頼者向けメニュー */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
            依頼者向けメニュー
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            上部の「現在のユーザー」から自分のユーザー名を選択したうえで、所持情報を登録してください。
          </p>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <Link
              href="/my/officers"
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex flex-col transition-colors"
            >
              <span className="font-semibold mb-1 text-gray-900 dark:text-gray-100">
                所持武将登録
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                所持している武将と枚数を登録します。
              </span>
            </Link>

            <Link
              href="/my/skills"
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex flex-col transition-colors"
            >
              <span className="font-semibold mb-1 text-gray-900 dark:text-gray-100">
                所持戦法登録
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                所持している戦法を登録します。
              </span>
            </Link>
    {/* ★ 追加：自分宛の編成を見る */}
    <Link
      href="/formation?owner=me"
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 flex flex-col transition-colors"
    >
      <span className="font-semibold mb-1">自分宛の編成を見る</span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
        編成者に作ってもらった自分の編成を一覧で確認します。
        （上部の現在のユーザーで自分の名前を選んでから開いてください）
      </span>
    </Link>
          </div>
        </section>

        {/* 編成者向けメニュー */}
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
            編成者向けメニュー
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
            上部の「現在のユーザー」で自分のユーザー名を選択したうえで、「編成作成」から依頼者の編成を作成します。
          </p>

          <div className="grid gap-3 md:grid-cols-1 text-sm">
            <Link
              href="/formation"
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/30 flex flex-col transition-colors"
            >
              <span className="font-semibold mb-1 text-gray-900 dark:text-gray-100">
                編成作成
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                画面上部の「依頼者」から依頼者のユーザー名を選び、
                その人の所持武将・戦法をもとに編成1～編成5を作成します。
                編成ごとに依頼者コメント・編成者コメントも記録できます。
              </span>
            </Link>
          </div>
        </section>

        {/* フッター的な補足 */}
        <footer className="text-[11px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p>
            ※ ユーザー名はゲーム内の名前など、一門内で誰かわかるものを推奨します。
          </p>
          <p>※ データは Supabase 上に保存され、一門メンバーで共有されます。</p>
          <p>
            ※ 編成には「依頼者」と「編成者」の両方が記録されるため、誰がどの編成を作ったか後から確認できます。
          </p>
        </footer>
      </div>
    </main>
  );
}
