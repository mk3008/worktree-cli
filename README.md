# Git Worktree Manager

TypeScriptでgit worktreeを使ったリポジトリ管理ツールです。複数ブランチを並行して作業できるディレクトリ構造を提供します。

## ディレクトリ構造

```
repositories/
  └── {repository-name}/
      ├── .bare/        (bareリポジトリ - 中央管理)
      ├── main/         (mainブランチ)
      ├── develop/      (developブランチ)
      └── feature1/     (featureブランチ)
```

## セットアップ

```bash
npm install
```

## 使い方

すべてのコマンドはプロジェクトルート（package.jsonがある場所）で実行します。

### 1. リポジトリのクローン

```bash
npm run clone {URL}
```

```bash
# 例: rawsql-ts
npm run clone https://github.com/mk3008/rawsql-ts.git
```

### 2. ブランチの作成

```bash
# デフォルトブランチ（main/master）から新しいブランチを作成
npm run branch rawsql-ts feature1

# 特定のブランチから新しいブランチを作成
npm run branch rawsql-ts feature2 develop

# VSCodeで自動的に開く
npm run branch:vscode rawsql-ts feature3
```

### 3. worktree一覧の表示

```bash
# 全リポジトリを表示
npm run list

# 特定リポジトリのworktree一覧
npm run list rawsql-ts
```

### 4. worktreeの削除

```bash
npm run remove rawsql-ts feature1
```

### 5. インタラクティブモード

```bash
# ウィザード形式でメニューから選択
npx worktree
```

### 6. ヘルプの表示

```bash
npm run help
```

## 使用例

```bash
# 作業したいリポジトリをクローン（例）
npm run clone https://github.com/mk3008/rawsql-ts.git

# 機能ブランチを作成
npm run branch rawsql-ts feature1
npm run branch rawsql-ts hotfix1

# 各ブランチで並行作業
cd repositories/rawsql-ts/main
# ... mainブランチでの作業 ...

# 別のターミナルで
cd repositories/rawsql-ts/feature1
# ... feature1ブランチでの作業 ...

# worktree一覧確認
npm run list rawsql-ts

# 不要なブランチを削除
npm run remove rawsql-ts feature1
```

## 機能

- **自動デフォルトブランチ検出**: clone時にリポジトリのデフォルトブランチ（main/master）を自動検出・記録
- **リモートブランチベース**: 常に最新のリモート状態からブランチを作成（ローカルブランチの状態に依存しない）
- **並行作業**: ブランチ切り替えなしで複数ブランチを同時に編集可能
- **VSCode統合**: WSLリモート環境での自動VSCode起動をサポート
- **シンプルなコマンド**: ルートディレクトリからすべての操作が可能
- **設定保存**: 各リポジトリの設定を`.worktree.json`に保存
- **インタラクティブモード**: `npx worktree`でウィザード形式の操作が可能

## 注意事項

- `.bare`ディレクトリはbareリポジトリで、直接編集しないでください
- 各ブランチは独立したワーキングディレクトリとして機能します
- `repositories/`フォルダは`.gitignore`に追加済みです