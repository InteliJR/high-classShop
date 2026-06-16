import { S3Service } from 'src/aws/s3.service';

// Heurística: chave S3 (gerada pelo CompaniesService/OfficeService) começa com `companies/`.
// Logos legados em base64 ficam sem prefixo de path e retornam null aqui.
export function isCompanyS3Key(
  value: string | null | undefined,
): value is string {
  return !!value && value.startsWith('companies/');
}

export async function resolveCompanyLogoUrl(
  s3: S3Service,
  logo: string | null,
): Promise<string | null> {
  if (!isCompanyS3Key(logo)) return null;
  return s3.getSignedUrl(logo);
}
