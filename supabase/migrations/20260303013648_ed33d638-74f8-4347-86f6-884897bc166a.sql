
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM irpf_cases
  WHERE tenant_id = '30e6da4c-ed58-47ce-8a83-289b58ca15ab'
)
UPDATE irpf_cases SET responsavel = CASE 
  WHEN (SELECT rn FROM numbered WHERE numbered.id = irpf_cases.id) % 2 = 1 THEN 'Grazi'
  ELSE 'Pedro'
END
WHERE tenant_id = '30e6da4c-ed58-47ce-8a83-289b58ca15ab';
