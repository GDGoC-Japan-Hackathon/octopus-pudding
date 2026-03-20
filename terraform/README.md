# Terraform backend bootstrap (dev/prod)

このディレクトリは、バックエンド向け Terraform の実行基盤です。
Cloud Run / Artifact Registry / Cloud Build Trigger / Cloud SQL / Secret Manager を module 構成で管理します。

## 構成

- `terraform/`: 共通ルートモジュール（オーケストレーション）
- `terraform/module/`: サービス別モジュール
- `terraform/environments/dev`: dev 用 root module
- `terraform/environments/prod`: prod 用 root module

## 初期化手順

### dev

```bash
cd terraform/environments/dev
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform validate
terraform plan -var-file=terraform.tfvars
```

```bash
# plan結果を保存
terraform plan -var-file=terraform.tfvars -out=tfplan

# plan結果を適用
terraform apply tfplan
```

### prod

```bash
cd terraform/environments/prod
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform validate
terraform plan -var-file=terraform.tfvars
```

```bash
# plan結果を保存
terraform plan -var-file=terraform.tfvars -out=tfplan

# plan結果を適用
terraform apply tfplan
```

## 重要事項

- `backend/cloudbuild.yaml` の `--set-secrets` で参照する Secret 名は、Terraform のデフォルト Secret 名と一致させています。
- Secret の初期値は `terraform.tfvars` から投入されるため、取り扱いには注意してください。
- Cloud SQL は現時点で Public IP を使用する最小構成です（dev 向け）。
