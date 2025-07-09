export default async function(request, response) {
  const { id, info } = request.params;
  
  try {
    const updateData = await request.json();
    
    // Example response for replacing user info
    const updatedUser = {
      id: id,
      message: 'User info replaced successfully',
      newData: updateData,
      updatedAt: new Date().toISOString()
    };
    
    response.json(updatedUser);
  } catch (error) {
    response.status(400).json({ error: 'Invalid JSON' });
  }
}
