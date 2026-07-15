export const checkGroupMembership = (group, userId) => {
  const isStudent = group.students.some(
    (student) => student.toString() === userId.toString(),
  );

  const isTeacher = group.teacher && (group.teacher._id || group.teacher).toString() === userId.toString();

  return isStudent || isTeacher;
};
