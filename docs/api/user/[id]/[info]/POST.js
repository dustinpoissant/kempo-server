export default async function(request, response) {
  const { id, info } = request.params;
  
  try {
    const updateData = await request.json();
    
    // Example response for updating user info
    const updatedUser = {
      id: id,
      message: 'User info updated successfully',
      updatedFields: updateData
    };
    
    response.json(updatedUser);
  } catch (error) {
    response.status(400).json({ error: 'Invalid JSON' });
  }
}
