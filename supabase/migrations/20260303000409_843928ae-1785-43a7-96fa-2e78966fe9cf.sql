
-- Insert irpf-pg and irpf-contmax modules
INSERT INTO modules (slug, nome, descricao, icone, ativo, ordem, organizacao_id)
VALUES 
  ('irpf-pg', 'IRPF P&G', 'Declarações de IRPF - P&G', 'FileText', true, 10, '30e6da4c-ed58-47ce-8a83-289b58ca15ab'),
  ('irpf-contmax', 'IRPF Contmax', 'Declarações de IRPF - Contmax', 'FileText', true, 11, 'd84e2150-0ae0-4462-880c-da8cec89e96a');

-- Deactivate generic irpf module
UPDATE modules SET ativo = false WHERE slug = 'irpf';
