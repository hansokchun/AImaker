-- Keep product image and video uploads within the limits supported by the registration UI.
update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
where id = 'product-samples';
