# Terraform backend bootstrap (dev/prod)

このディレクトリは、バックエンド向け Terraform の実行基盤です。
今回はリソース作成は行わず、`init/validate/plan` が通る最小構成のみを用意しています。

## 構成

- `terraform/`: 共通モジュール（provider/variables/outputs）
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

### prod

```bash
cd terraform/environments/prod
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform validate
terraform plan -var-file=terraform.tfvars
```

## backend.hcl について

`backend "gcs"` の値はコードに固定せず、環境ごとの `backend.hcl` で注入します。

例:

```hcl
bucket = "your-terraform-state-bucket"
prefix = "backend/dev"
```
