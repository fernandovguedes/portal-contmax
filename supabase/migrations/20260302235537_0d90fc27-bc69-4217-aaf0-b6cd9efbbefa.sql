
-- 1. Create irpf-docs storage bucket (PRIVATE)
INSERT INTO storage.buckets (id, name, public)
VALUES ('irpf-docs', 'irpf-docs', false);

-- 2. Storage RLS policies
CREATE POLICY "irpf_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'irpf-docs'
  AND (
    has_module_access(auth.uid(), 'irpf')
    OR has_module_access(auth.uid(), 'irpf-pg')
    OR has_module_access(auth.uid(), 'irpf-contmax')
  )
);

CREATE POLICY "irpf_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'irpf-docs'
  AND (
    has_module_access(auth.uid(), 'irpf')
    OR has_module_access(auth.uid(), 'irpf-pg')
    OR has_module_access(auth.uid(), 'irpf-contmax')
  )
);

CREATE POLICY "irpf_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'irpf-docs'
  AND (
    has_module_edit_access(auth.uid(), 'irpf')
    OR has_module_edit_access(auth.uid(), 'irpf-pg')
    OR has_module_edit_access(auth.uid(), 'irpf-contmax')
  )
);

-- 3. Update irpf_cases RLS policies to accept new slugs
DROP POLICY IF EXISTS "irpf_cases_insert" ON irpf_cases;
CREATE POLICY "irpf_cases_insert" ON irpf_cases FOR INSERT TO authenticated
WITH CHECK (
  has_module_access(auth.uid(), 'irpf')
  OR has_module_access(auth.uid(), 'irpf-pg')
  OR has_module_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_cases_update" ON irpf_cases;
CREATE POLICY "irpf_cases_update" ON irpf_cases FOR UPDATE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_cases_delete" ON irpf_cases;
CREATE POLICY "irpf_cases_delete" ON irpf_cases FOR DELETE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);

-- 4. Update irpf_people RLS policies
DROP POLICY IF EXISTS "irpf_people_insert" ON irpf_people;
CREATE POLICY "irpf_people_insert" ON irpf_people FOR INSERT TO authenticated
WITH CHECK (
  has_module_access(auth.uid(), 'irpf')
  OR has_module_access(auth.uid(), 'irpf-pg')
  OR has_module_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_people_update" ON irpf_people;
CREATE POLICY "irpf_people_update" ON irpf_people FOR UPDATE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_people_delete" ON irpf_people;
CREATE POLICY "irpf_people_delete" ON irpf_people FOR DELETE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);

-- 5. Update irpf_documents RLS policies
DROP POLICY IF EXISTS "irpf_docs_insert" ON irpf_documents;
CREATE POLICY "irpf_docs_insert" ON irpf_documents FOR INSERT TO authenticated
WITH CHECK (
  has_module_access(auth.uid(), 'irpf')
  OR has_module_access(auth.uid(), 'irpf-pg')
  OR has_module_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_docs_update" ON irpf_documents;
CREATE POLICY "irpf_docs_update" ON irpf_documents FOR UPDATE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);

DROP POLICY IF EXISTS "irpf_docs_delete" ON irpf_documents;
CREATE POLICY "irpf_docs_delete" ON irpf_documents FOR DELETE TO authenticated
USING (
  has_module_edit_access(auth.uid(), 'irpf')
  OR has_module_edit_access(auth.uid(), 'irpf-pg')
  OR has_module_edit_access(auth.uid(), 'irpf-contmax')
);
