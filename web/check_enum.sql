SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'milestonestatusenum'::regtype
ORDER BY enumsortorder;
